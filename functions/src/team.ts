import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { enforceRateLimit } from "./rate-limit";

// getFirestore()/getAuth() נקראים בתוך ההנדלר (לא בטעינת המודול) כדי
// שה-initializeApp() שב-index.ts יספיק לרוץ קודם.
const db = () => getFirestore();
const auth = () => getAuth();

const resendApiKey = defineSecret("RESEND_API_KEY");
const emailFrom = defineString("EMAIL_FROM", { default: "" });
const appUrl = defineString("APP_URL", { default: "https://easyhall.vercel.app" });

type OrgRole = "admin" | "sales_rep" | "office" | "event_manager" | "accounting";
const VALID_ROLES: OrgRole[] = ["admin", "sales_rep", "office", "event_manager", "accounting"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInviteHtml(venueName: string, fullName: string, activationUrl: string, logoUrl?: string): string {
  const venue = escapeHtml(venueName);
  const name = escapeHtml(fullName);
  const brand = "#5980a6";
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${venue}" style="display:block;max-height:40px;max-width:180px;margin:0 auto 18px;border:0;" />`
    : "";
  return `<!doctype html>
<html dir="rtl" lang="he">
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;text-align:center;">
      <div style="height:6px;background:${brand};"></div>
      <div style="padding:32px 28px 28px;">
        ${logoHtml}
        <span style="display:inline-block;font-size:11px;letter-spacing:0.06em;font-weight:700;color:${brand};background:#eaf0f6;padding:4px 10px;border-radius:999px;margin-bottom:18px;">הזמנה לצוות</span>
        <h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:#1c1917;line-height:1.4;">שלום ${name}, ברוכים הבאים לצוות ${venue}! 🎉</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3a3532;">
          תודה שהצטרפתם אלינו - נשמח שתהיו חלק מהצוות שמנהל כאן כל אירוע, מהליד הראשון ועד המזל טוב.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3a3532;">
          נשאר רק צעד אחד: לחצו על הכפתור, קבעו סיסמה משלכם, ותוכלו להיכנס למערכת מיד.
        </p>
        <p style="margin:26px 0 22px;">
          <a href="${activationUrl}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:9px;font-size:15px;font-weight:600;">
            קביעת סיסמה והפעלת החשבון
          </a>
        </p>
        <p style="margin:0 0 4px;font-size:12px;color:#78716c;">אם הכפתור לא עובד, אפשר להעתיק את הקישור:</p>
        <p style="margin:0 0 22px;font-size:12px;color:#78716c;word-break:break-all;" dir="ltr">${activationUrl}</p>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:0 0 16px;" />
        <p style="margin:0;font-size:12px;color:#78716c;">${venue} · EasyHall</p>
      </div>
    </div>
  </body>
</html>`;
}

async function requireOrgAdmin(orgId: string, uid: string) {
  const memberSnap = await db().collection("organizations").doc(orgId).collection("members").doc(uid).get();
  if (!memberSnap.exists || memberSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "רק מנהל יכול לנהל את הצוות.");
  }
}

/**
 * מזמין חבר צוות: יוצר עבורו ישירות חשבון Firebase Auth + חברות בארגון
 * (status "pending"), ושולח לו מייל עם קישור אישי (מבוסס קישור איפוס סיסמה
 * מובנה של Firebase — אין קוד נפרד להקליד) לקביעת סיסמה משלו.
 */
export const inviteTeamMember = onCall({ secrets: [resendApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  const firstName = String(request.data?.firstName ?? "").trim();
  const lastName = String(request.data?.lastName ?? "").trim();
  const email = String(request.data?.email ?? "").trim().toLowerCase();
  const role = String(request.data?.role ?? "") as OrgRole;

  if (!orgId) throw new HttpsError("invalid-argument", "חסר מזהה ארגון.");
  if (!firstName || !lastName) throw new HttpsError("invalid-argument", "יש להזין שם פרטי ושם משפחה.");
  if (!email || !email.includes("@")) throw new HttpsError("invalid-argument", "כתובת מייל לא תקינה.");
  if (!VALID_ROLES.includes(role)) throw new HttpsError("invalid-argument", "תפקיד לא תקין.");

  await requireOrgAdmin(orgId, request.auth.uid);

  // כל קריאה מוצלחת יוצרת חשבון Auth ושולחת מייל דרך Resend — admin שנפרץ
  // (או באג בלולאה בצד הלקוח) יכול היה לשרוף את כל מכסת המייל החודשית
  // וליצור עשרות חשבונות בכמה שניות. הגבלה לפי מי שמזמין, לא לפי IP —
  // זו פעולה שדורשת התחברות ותפקיד admin ממילא.
  await enforceRateLimit({
    key: `inviteTeamMember:${request.auth.uid}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
    message: "יותר מדי הזמנות בפרק זמן קצר — נסו שוב בעוד שעה.",
  });

  const apiKey = resendApiKey.value();
  const from = emailFrom.value().trim();
  if (!apiKey || !from) {
    throw new HttpsError(
      "failed-precondition",
      "שליחת מייל מהמערכת עדיין לא הוגדרה. יש להגדיר דומיין מאומת ב-Resend."
    );
  }

  const orgSnap = await db().collection("organizations").doc(orgId).get();
  const orgName = String(orgSnap.data()?.name ?? "האולם");
  const logoUrl = orgSnap.data()?.logoUrl as string | undefined;
  const fullName = `${firstName} ${lastName}`.trim();

  let uid: string;
  try {
    const userRecord = await auth().createUser({ email, emailVerified: true, displayName: fullName, disabled: false });
    uid = userRecord.uid;
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "כבר קיים משתמש עם כתובת המייל הזו.");
    }
    throw new HttpsError("internal", "יצירת המשתמש נכשלה.");
  }

  const batch = db().batch();
  batch.set(db().collection("users").doc(uid), { fullName }, { merge: true });
  batch.set(db().collection("organizations").doc(orgId).collection("members").doc(uid), {
    userId: uid,
    fullName,
    orgName,
    role,
    isActive: true,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    db().collection("userOrgs").doc(uid),
    { orgs: FieldValue.arrayUnion({ orgId, orgName, role, fullName }) },
    { merge: true }
  );
  await batch.commit();

  // מכאן ואילך כל כשל (יצירת קישור/שליחת מייל) צריך לבטל את החשבון והמסמכים
  // שכבר נוצרו — אחרת נשאר חבר "ממתין להפעלה" לנצח, בלי שום דרך להפעיל אותו.
  const rollback = async () => {
    await Promise.allSettled([
      auth().deleteUser(uid),
      db().collection("organizations").doc(orgId).collection("members").doc(uid).delete(),
      db().collection("users").doc(uid).delete(),
    ]);
  };

  let actionLink: string;
  try {
    actionLink = await auth().generatePasswordResetLink(email, {
      url: `${appUrl.value()}/activate`,
      handleCodeInApp: true,
    });
  } catch {
    await rollback();
    throw new HttpsError("internal", "יצירת קישור ההפעלה נכשלה.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${orgName} <${from}>`,
      to: [email],
      subject: `הוזמנת להצטרף לצוות ${orgName} ב-EasyHall`,
      html: buildInviteHtml(orgName, fullName, actionLink, logoUrl),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    await rollback();
    throw new HttpsError("internal", `שליחת מייל ההזמנה נכשלה (${res.status}). ${detail}`.trim());
  }

  return { success: true, uid };
});

/**
 * מסיר חבר צוות לגמרי: מוחק גם את מסמך החברות וגם את חשבון ה-Auth שלו
 * (ומנקה את השיוך ב-userOrgs), כדי שהמייל שלו יהיה פנוי לשימוש חוזר.
 */
export const removeTeamMember = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  const memberId = String(request.data?.memberId ?? "").trim();
  if (!orgId || !memberId) {
    throw new HttpsError("invalid-argument", "חסרים פרטי חבר הצוות.");
  }
  if (memberId === request.auth.uid) {
    throw new HttpsError("failed-precondition", "לא ניתן להסיר את עצמך מהצוות.");
  }

  await requireOrgAdmin(orgId, request.auth.uid);

  await db().collection("organizations").doc(orgId).collection("members").doc(memberId).delete();

  const userOrgsRef = db().collection("userOrgs").doc(memberId);
  const userOrgsSnap = await userOrgsRef.get();
  if (userOrgsSnap.exists) {
    const orgs = (userOrgsSnap.data()?.orgs ?? []) as { orgId: string }[];
    await userOrgsRef.set({ orgs: orgs.filter((o) => o.orgId !== orgId) }, { merge: true });
  }

  // best-effort: אם החשבון כבר נמחק (למשל קריאה כפולה), לא צריך להיכשל על זה.
  await auth()
    .deleteUser(memberId)
    .catch(() => {});

  return { success: true };
});

/**
 * נקראת מהלקוח מיד אחרי שהמוזמן קבע סיסמה בהצלחה (confirmPasswordReset) —
 * מסמנת אותו כ"פעיל" בכל הארגונים שהוא רשום בהם. לא ניתן לעדכן status
 * מהלקוח ישירות: כללי ה-Firestore מתירים עדכון מסמך חבר רק ל-admin, כדי
 * שאף אחד לא יוכל "לאשר את עצמו" מהדפדפן.
 */
export const activateAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const uid = request.auth.uid;
  const userOrgsSnap = await db().collection("userOrgs").doc(uid).get();
  const orgs = (userOrgsSnap.data()?.orgs ?? []) as { orgId: string }[];

  const batch = db().batch();
  for (const { orgId } of orgs) {
    batch.set(
      db().collection("organizations").doc(orgId).collection("members").doc(uid),
      { status: "active" },
      { merge: true }
    );
  }
  await batch.commit();

  return { success: true };
});
