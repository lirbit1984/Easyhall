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
  if (refreshToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
    } catch {
      // best-effort — גם אם הביטול מול גוגל נכשל, ננתק בכל זאת מקומית
    }
  }

  const eventsSnap = await secretRef.collection("events").get();
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

async function buildEventTitle(orgId: string, calEvent: FirebaseFirestore.DocumentData): Promise<string | null> {
  const leadSnap = await db().collection("organizations").doc(orgId).collection("leads").doc(calEvent.lead_id).get();
  const lead = leadSnap.data();
  const typeLabel = CALENDAR_EVENT_TYPE_LABELS[calEvent.event_type] ?? "אירוע";

  if (calEvent.event_type === "meeting" && calEvent.meeting_id) {
    const meeting = (lead?.meetings as { meeting_id: string; status?: string }[] | undefined)?.find(
      (m) => m.meeting_id === calEvent.meeting_id
    );
    if (meeting?.status === "cancelled") return null; // פגישה שבוטלה לא מסונכרנת
  }

  if (lead?.custom_title?.trim()) return `${lead.custom_title.trim()} — ${typeLabel}`;
  const contacts = (lead?.contacts as { role_key: string; name: string }[] | undefined) ?? [];
  const bride = contacts.find((c) => c.role_key === "bride")?.name;
  const groom = contacts.find((c) => c.role_key === "groom")?.name;
  const names = bride && groom ? `${bride} & ${groom}` : bride || groom || contacts[0]?.name;
  return `${names ?? "אירוע"} — ${typeLabel}`;
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

  const title = after ? await buildEventTitle(orgId, after) : null;

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

  const body = {
    summary: title,
    start: { dateTime: after.start_time },
    end: { dateTime: after.end_time },
  };

  if (existingGoogleEventId) {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingGoogleEventId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  } else {
    const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
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
