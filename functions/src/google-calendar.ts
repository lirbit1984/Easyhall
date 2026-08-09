import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// getFirestore() נקרא בתוך ההנדלרים (לא בטעינת המודול) כדי ש-initializeApp()
// שב-index.ts יספיק לרוץ קודם.
const db = () => getFirestore();

const googleClientId = defineSecret("GOOGLE_CLIENT_ID");
const googleClientSecret = defineSecret("GOOGLE_CLIENT_SECRET");
const appUrl = defineString("APP_URL", { default: "https://easyhall.vercel.app" });
// כתובת ה-callback הרשומה בפועל ב-Google Cloud Console (Authorized redirect
// URIs) — כתובת ה-Cloud Function עצמה, לא כתובת האתר, כי רק לפונקציה יש
// גישת Admin SDK לכתוב את הטוקנים ל-Firestore.
const googleRedirectUri = defineString("GOOGLE_REDIRECT_URI");

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

async function requireOrgMember(orgId: string, uid: string) {
  const memberSnap = await db().collection("organizations").doc(orgId).collection("members").doc(uid).get();
  if (!memberSnap.exists) {
    throw new HttpsError("permission-denied", "אינך חבר בארגון הזה.");
  }
}

/**
 * מחזיר קישור התחברות ל-Google (OAuth) עבור המשתמש הנוכחי. שומר state
 * חד-פעמי ב-oauthStates כדי לוודא ב-callback שהבקשה אכן הגיעה מכאן ולמנוע
 * שתילת orgId/uid זרים בפרמטר state.
 */
export const getGoogleAuthUrl = onCall({ secrets: [googleClientId] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  if (!orgId) {
    throw new HttpsError("invalid-argument", "orgId חסר.");
  }
  await requireOrgMember(orgId, request.auth.uid);

  const stateRef = db().collection("oauthStates").doc();
  await stateRef.set({
    orgId,
    uid: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  const params = new URLSearchParams({
    client_id: googleClientId.value(),
    redirect_uri: googleRedirectUri.value(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/calendar.events",
    state: stateRef.id,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
});

/**
 * מנתק את חיבור ה-Google Calendar של המשתמש: מבטל את הטוקן מול גוגל
 * (best-effort), ומוחק את הסוד + מיפוי האירועים ששמורים בשרת.
 */
export const disconnectGoogleCalendar = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  if (!orgId) {
    throw new HttpsError("invalid-argument", "orgId חסר.");
  }
  await requireOrgMember(orgId, request.auth.uid);

  const secretRef = db().collection("organizations").doc(orgId).collection("private").doc(`googleCalendar_${request.auth.uid}`);
  const secretSnap = await secretRef.get();
  const refreshToken = secretSnap.data()?.refreshToken as string | undefined;

  const eventsSnap = await secretRef.collection("events").get();

  // מוחקים את האירועים בפועל מגוגל *לפני* שמבטלים את הטוקן — אחרת בהתחברות
  // הבאה ה-backfill לא ימצא מיפוי קיים ויוצר עותקים כפולים לצד אלה שנשארו.
  const tokens = refreshToken ? await getFreshAccessToken(orgId, request.auth.uid) : null;
  if (tokens) {
    await Promise.all(
      eventsSnap.docs.map((d) => {
        const googleEventId = d.data().googleEventId as string | undefined;
        if (!googleEventId) return Promise.resolve();
        return fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${tokens.accessToken}` },
        }).catch(() => {});
      })
    );
  }

  if (refreshToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
    } catch {
      // best-effort — גם אם הביטול מול גוגל נכשל, ננתק בכל זאת מקומית
    }
  }

  const batch = db().batch();
  eventsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(secretRef);
  batch.set(
    db().collection("organizations").doc(orgId).collection("members").doc(request.auth.uid),
    { googleCalendarConnected: false },
    { merge: true }
  );
  await batch.commit();
  return { success: true };
});

/**
 * "רענון מלא": מוחקת מגוגל את *כל* האירועים שהמערכת אי-פעם יצרה למשתמש הזה
 * (כולל כאלה שהמיפוי המקומי אליהם כבר אבד — למשל בגלל ניתוקים ישנים לפני
 * שהוספנו ניקוי אוטומטי), מנקה את המיפוי המקומי, ובונה הכל מחדש מ-Firestore.
 * פותר כפילויות/נתונים ישנים בלי לדרוש מהמשתמש למחוק ידנית בגוגל עצמו.
 */
export const resyncGoogleCalendar = onCall({ secrets: [googleClientId, googleClientSecret] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  if (!orgId) {
    throw new HttpsError("invalid-argument", "orgId חסר.");
  }
  await requireOrgMember(orgId, request.auth.uid);
  const uid = request.auth.uid;

  const tokens = await getFreshAccessToken(orgId, uid);
  if (!tokens) {
    throw new HttpsError("failed-precondition", "Google Calendar לא מחובר.");
  }

  // מנקה כפילויות ישנות של "אירוע סגור" ב-Firestore עצמו (מלפני שהתווסף
  // ניקוי אוטומטי ל-syncCalendarForLead) — בלעדי זה, כל כפילות ממשיכה
  // "לצוץ" מחדש בכל resync כי היא באמת קיימת אצלנו, לא רק בגוגל.
  const calendarEventsSnap = await db().collection("organizations").doc(orgId).collection("calendarEvents").get();
  const seenConfirmed = new Set<string>();
  const staleDeletes: Promise<unknown>[] = [];
  for (const d of calendarEventsSnap.docs) {
    const data = d.data();
    if (data.event_type !== "confirmed_event") continue;
    const key = data.lead_id as string;
    if (seenConfirmed.has(key)) {
      staleDeletes.push(d.ref.delete());
    } else {
      seenConfirmed.add(key);
    }
  }
  await Promise.all(staleDeletes);

  let pageToken: string | undefined;
  let deleted = 0;
  do {
    const params = new URLSearchParams({
      privateExtendedProperty: `easyhallOrgId=${orgId}`,
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const listRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!listRes.ok) break;
    const listData = (await listRes.json()) as { items?: { id: string }[]; nextPageToken?: string };
    for (const item of listData.items ?? []) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${item.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => {});
      deleted++;
    }
    pageToken = listData.nextPageToken;
  } while (pageToken);

  const secretRef = db().collection("organizations").doc(orgId).collection("private").doc(`googleCalendar_${uid}`);
  const eventsSnap = await secretRef.collection("events").get();
  const batch = db().batch();
  eventsSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  await backfillGoogleCalendar(orgId, uid, tokens.accessToken);
  return { success: true, deleted };
});

/**
 * ה-callback שגוגל מפנה אליו אחרי אישור המשתמש. מאמת את ה-state (חד-פעמי,
 * בתוקף 10 דקות), מחליף את ה-code בטוקנים, ושומר אותם תחת organizations/
 * {orgId}/private/googleCalendar_{uid} — נתיב שחסום לגמרי לקריאת/כתיבת לקוח
 * (allow read, write: if false), כדי שאף חבר ארגון אחר לא יוכל לגנוב טוקן.
 */
export const googleAuthCallback = onRequest(
  { secrets: [googleClientId, googleClientSecret] },
  async (req, res) => {
    const code = String(req.query.code ?? "");
    const stateId = String(req.query.state ?? "");
    const base = appUrl.value();

    if (req.query.error || !code || !stateId) {
      res.redirect(`${base}/calendar?google=error`);
      return;
    }

    const stateRef = db().collection("oauthStates").doc(stateId);
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      res.redirect(`${base}/calendar?google=error`);
      return;
    }
    const state = stateSnap.data() as { orgId: string; uid: string; createdAt?: Timestamp };
    await stateRef.delete();
    if (!state.createdAt || Date.now() - state.createdAt.toDate().getTime() > OAUTH_STATE_TTL_MS) {
      res.redirect(`${base}/calendar?google=error`);
      return;
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: googleClientId.value(),
          client_secret: googleClientSecret.value(),
          redirect_uri: googleRedirectUri.value(),
          grant_type: "authorization_code",
        }),
      });
      const tokenData = (await tokenRes.json()) as {
        refresh_token?: string;
        access_token?: string;
        expires_in?: number;
        error?: string;
      };
      if (!tokenRes.ok || !tokenData.refresh_token) {
        res.redirect(`${base}/calendar?google=error`);
        return;
      }

      await db()
        .collection("organizations")
        .doc(state.orgId)
        .collection("private")
        .doc(`googleCalendar_${state.uid}`)
        .set({
          refreshToken: tokenData.refresh_token,
          accessToken: tokenData.access_token ?? null,
          accessTokenExpiresAt: Timestamp.fromDate(new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000)),
          connectedAt: FieldValue.serverTimestamp(),
        });
      await db()
        .collection("organizations")
        .doc(state.orgId)
        .collection("members")
        .doc(state.uid)
        .set({ googleCalendarConnected: true }, { merge: true });

      if (tokenData.access_token) {
        await backfillGoogleCalendar(state.orgId, state.uid, tokenData.access_token).catch(() => {});
      }

      res.redirect(`${base}/calendar?google=connected`);
    } catch {
      res.redirect(`${base}/calendar?google=error`);
    }
  }
);

interface GoogleTokens {
  accessToken: string;
}

async function getFreshAccessToken(orgId: string, uid: string): Promise<GoogleTokens | null> {
  const secretRef = db().collection("organizations").doc(orgId).collection("private").doc(`googleCalendar_${uid}`);
  const snap = await secretRef.get();
  if (!snap.exists) return null;
  const data = snap.data() as { refreshToken: string; accessToken?: string; accessTokenExpiresAt?: Timestamp };

  if (data.accessToken && data.accessTokenExpiresAt && data.accessTokenExpiresAt.toDate().getTime() - Date.now() > 60_000) {
    return { accessToken: data.accessToken };
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: data.refreshToken,
      client_id: googleClientId.value(),
      client_secret: googleClientSecret.value(),
      grant_type: "refresh_token",
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenRes.ok || !tokenData.access_token) {
    // הטוקן בוטל/פג באופן בלתי הפיך מצד גוגל — מנתקים כדי שהמשתמש יידע
    // להתחבר מחדש, במקום להיכשל בשקט בכל סנכרון עתידי.
    await secretRef.delete();
    await db().collection("organizations").doc(orgId).collection("members").doc(uid).set({ googleCalendarConnected: false }, { merge: true });
    return null;
  }
  await secretRef.set(
    {
      accessToken: tokenData.access_token,
      accessTokenExpiresAt: Timestamp.fromDate(new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000)),
    },
    { merge: true }
  );
  return { accessToken: tokenData.access_token };
}

const CALENDAR_EVENT_TYPE_LABELS: Record<string, string> = {
  sales_meeting: "פגישת מכירה / סיור",
  option_hold: "תאריך משוריין / אופציה",
  confirmed_event: "אירוע סגור",
  meeting: "פגישה עם הזוג",
};

// colorId מהפלטה הקבועה של Google Calendar (1-11) — ברירת מחדל לפי סוג
// האירוע; לפגישות (event_type === "meeting") יש מיפוי מדויק יותר לפי סוג
// הפגישה עצמה, ראה MEETING_TYPE_COLOR_ID למטה.
const GOOGLE_COLOR_ID: Record<string, string> = {
  sales_meeting: "7", // Peacock (טווס)
  option_hold: "5", // Banana (בננה)
  confirmed_event: "10", // Basil (פיסטוק)
  meeting: "9", // Blueberry (ברירת מחדל אם סוג הפגישה לא זוהה)
};

// לפי בקשת המשתמש: צבע ייעודי לכל סוג פגישה בכרטיס הליד.
const MEETING_TYPE_COLOR_ID: Record<string, string> = {
  first: "7", // טווס — פגישה ראשונה
  additional: "4", // פריחת הדובדבן — פגישה נוספת/שנייה
  third: "5", // בננה — פגישה שלישית
  tasting: "11", // עגבנייה — טעימות
  expectations: "9", // ברירת מחדל — תיאום ציפיות (לא צויין ע"י המשתמש)
};

const CALENDAR_TIME_ZONE = "Asia/Jerusalem";

// שולחים ל-Google שעת קיר מפורשת + timeZone, במקום מסתמכים על "Z" (UTC
// מוחלט) — כי בלי timeZone מפורש Google הציג את השעה לפי אזור הזמן שהוגדר
// (או לא הוגדר) ביומן היעד עצמו, מה שגרם לפער קבוע של שעות מהערך האמיתי.
function toGoogleDateTime(isoUtc: string): { dateTime: string; timeZone: string } {
  const d = new Date(isoUtc);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    dateTime: `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`,
    timeZone: CALENDAR_TIME_ZONE,
  };
}

interface EventDetails {
  title: string | null;
  colorId: string | undefined;
}

const ROLE_LABELS: Record<string, string> = {
  bride: "כלה",
  groom: "חתן",
  bride_mother: "אמא כלה",
  bride_father: "אבא כלה",
  groom_mother: "אמא חתן",
  groom_father: "אבא חתן",
  event_producer: "מפיק אירוע",
  parent: "הורה",
  celebrant: "חוגג/ת",
  company_name: "שם החברה",
  business_rep: "נציג מטעם העסק",
  production_company: "חברת הפקה",
  guest: "איש קשר",
};

interface EventDetails {
  title: string | null;
  colorId: string | undefined;
  description?: string;
}

async function buildEventDetails(orgId: string, calEvent: FirebaseFirestore.DocumentData): Promise<EventDetails> {
  const orgRef = db().collection("organizations").doc(orgId);
  const leadSnap = await orgRef.collection("leads").doc(calEvent.lead_id).get();
  // הליד לא קיים (למשל נמחק) — אין מה לסנכרן, גם אם עדיין נשארה רשומת
  // calendarEvents יתומה שמצביעה עליו (deleteLeadSecure/cleanupOrphanedRecords
  // אמורים למנוע את זה, אבל זו הגנה נוספת).
  if (!leadSnap.exists) return { title: null, colorId: undefined };
  const lead = leadSnap.data();
  const typeLabel = CALENDAR_EVENT_TYPE_LABELS[calEvent.event_type] ?? "אירוע";
  let colorId = GOOGLE_COLOR_ID[calEvent.event_type as string];

  if (calEvent.event_type === "meeting" && calEvent.meeting_id) {
    const meeting = (lead?.meetings as { meeting_id: string; status?: string; type?: string }[] | undefined)?.find(
      (m) => m.meeting_id === calEvent.meeting_id
    );
    if (meeting?.status === "cancelled") return { title: null, colorId: undefined }; // פגישה שבוטלה לא מסונכרנת
    if (meeting?.type) colorId = MEETING_TYPE_COLOR_ID[meeting.type] ?? colorId;
  }

  const contacts = (lead?.contacts as { role_key: string; name: string; phone?: string }[] | undefined) ?? [];
  const bride = contacts.find((c) => c.role_key === "bride")?.name;
  const groom = contacts.find((c) => c.role_key === "groom")?.name;
  const names = bride && groom ? `${bride} & ${groom}` : bride || groom || contacts[0]?.name;
  const title = lead?.custom_title?.trim()
    ? `${lead.custom_title.trim()} — ${typeLabel}`
    : `${names ?? "אירוע"} — ${typeLabel}`;

  const eventTypeName = lead?.event_type_id
    ? (await orgRef.collection("eventTypes").doc(lead.event_type_id).get()).data()?.name
    : undefined;

  const descriptionLines = [
    ...contacts.map((c) => `${ROLE_LABELS[c.role_key] ?? c.role_key}: ${c.name}${c.phone ? ` — ${c.phone}` : ""}`),
    eventTypeName ? `סוג אירוע: ${eventTypeName}` : null,
    typeof lead?.estimated_guests === "number" ? `כמות אורחים: ${lead.estimated_guests}` : null,
  ].filter((line): line is string => !!line);

  return { title, colorId, description: descriptionLines.join("\n") || undefined };
}

/**
 * דוחף אירוע יומן בודד ליומן ה-Google הראשי של משתמש מחובר ספציפי —
 * יוצר/מעדכן/מוחק לפי מיפוי googleEventId ששמור תחת ה-secret הפרטי שלו.
 * משמש גם מהטריגר על כל שינוי בודד, וגם מה-backfill שרץ פעם אחת בהתחברות.
 */
async function pushEventToGoogle(
  orgId: string,
  uid: string,
  eventId: string,
  after: FirebaseFirestore.DocumentData | null,
  accessToken: string
) {
  const mapRef = db()
    .collection("organizations")
    .doc(orgId)
    .collection("private")
    .doc(`googleCalendar_${uid}`)
    .collection("events")
    .doc(eventId);
  const mapSnap = await mapRef.get();
  const existingGoogleEventId = mapSnap.data()?.googleEventId as string | undefined;

  const { title, colorId, description } = after
    ? await buildEventDetails(orgId, after)
    : { title: null, colorId: undefined, description: undefined };

  // אירוע נמחק, בוטל (title null), או שהוא פגישה שבוטלה — מסירים מגוגל.
  if (!after || !title) {
    if (existingGoogleEventId) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingGoogleEventId}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
      }).catch(() => {});
      await mapRef.delete();
    }
    return;
  }

  // אירועים סגורים בלי שעה מוגדרת (event_start_time ריק) מגיעים כתאריך
  // גולמי בלי שעה (למשל "2026-08-29") — לא dateTime תקין. Google מבחינה בין
  // dateTime (עם שעה) ל-date (יום שלם), אז בוחרים לפי אורך המחרוזת.
  const isFullDay = (v: string) => !v.includes("T");
  // כשלליד יש אותה שעת התחלה וסיום (או event_end_time לא הוגדר), הטווח
  // יוצא ריק — גוגל דוחה זאת (timeRangeEmpty). קובעים סיום מינימלי שעה
  // אחרי ההתחלה רק בשליחה לגוגל, בלי לגעת בנתון המקורי אצלנו.
  let endTime = after.end_time as string;
  if (endTime <= after.start_time && !isFullDay(after.start_time)) {
    endTime = new Date(new Date(after.start_time).getTime() + 60 * 60 * 1000).toISOString();
  }
  const body = {
    summary: title,
    description,
    start: isFullDay(after.start_time) ? { date: after.start_time } : toGoogleDateTime(after.start_time),
    end: isFullDay(endTime) ? { date: endTime } : toGoogleDateTime(endTime),
    colorId,
    // מתייג כל אירוע שאנחנו יוצרים כדי שאפשר יהיה למצוא/לנקות אותו מול גוגל
    // ישירות (resyncGoogleCalendar) גם אם המיפוי המקומי אצלנו אבד/התיישן.
    extendedProperties: { private: { easyhallApp: "1", easyhallOrgId: orgId } },
  };

  if (existingGoogleEventId) {
    const patchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingGoogleEventId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch((err) => {
      console.error(`[google-calendar] PATCH failed for ${eventId}`, err);
      return null;
    });
    if (patchRes && !patchRes.ok) {
      console.error(`[google-calendar] PATCH rejected for ${eventId}: ${patchRes.status} ${await patchRes.text()}`);
    }
  } else {
    const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!createRes.ok) {
      console.error(`[google-calendar] CREATE rejected for ${eventId}: ${createRes.status} ${await createRes.text()}`);
      return;
    }
    const created = (await createRes.json()) as { id?: string };
    if (created.id) {
      await mapRef.set({ googleEventId: created.id });
    }
  }
}

/**
 * מסנכרן כל שינוי ב-calendarEvents ליומן Google של כל חבר ארגון שמחובר —
 * כל אחד רואה ביומן האישי שלו את כל יומן האולם, בהתאם להחלטה שלו אם לחבר.
 */
export const syncCalendarEventToGoogle = onDocumentWritten(
  { document: "organizations/{orgId}/calendarEvents/{eventId}", secrets: [googleClientId, googleClientSecret] },
  async (event) => {
    const orgId = event.params.orgId as string;
    const eventId = event.params.eventId as string;
    const after = event.data?.after.exists ? (event.data.after.data() ?? null) : null;

    const membersSnap = await db()
      .collection("organizations")
      .doc(orgId)
      .collection("members")
      .where("googleCalendarConnected", "==", true)
      .get();
    if (membersSnap.empty) return;

    for (const memberDoc of membersSnap.docs) {
      const uid = memberDoc.id;
      const tokens = await getFreshAccessToken(orgId, uid);
      if (!tokens) continue;
      await pushEventToGoogle(orgId, uid, eventId, after, tokens.accessToken);
    }
  }
);

/**
 * סנכרון ראשוני חד-פעמי: רץ אוטומטית מיד אחרי חיבור מוצלח (googleAuthCallback)
 * כדי להעביר לגוגל גם אירועים שכבר היו קיימים ביומן לפני החיבור — הטריגר
 * הרגיל מגיב רק לכתיבות חדשות, ולכן לא נוגע באירועים ישנים בלי הרצה כזו.
 */
async function backfillGoogleCalendar(orgId: string, uid: string, accessToken: string) {
  const eventsSnap = await db().collection("organizations").doc(orgId).collection("calendarEvents").get();
  for (const eventDoc of eventsSnap.docs) {
    await pushEventToGoogle(orgId, uid, eventDoc.id, eventDoc.data(), accessToken);
  }
}
