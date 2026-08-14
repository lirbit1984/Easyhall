import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { enforceRateLimit, callerIp } from "./rate-limit";

const db = () => getFirestore();

const resendApiKey = defineSecret("RESEND_API_KEY");
const emailFrom = defineString("EMAIL_FROM", { default: "" });

/** לירן — מקבל התרעה על כל פנייה מדף הנחיתה. */
const SITE_LEAD_ALERT_EMAIL = "peanuts.rlz@gmail.com";

/** טלפון ישראלי: נייד (05x) או קווי, עם או בלי מקף, גם בפורמט +972. */
const IL_PHONE = /^(?:\+?972|0)(?:[23489]|5\d|7\d)-?\d{7}$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * קליטת פנייה מטופס "דברו איתנו" בדף הנחיתה.
 *
 * הטופס פתוח לציבור ולכן הפונקציה לא דורשת התחברות — אבל היא כן מנרמלת
 * ומאמתת את הקלט, חוסמת הצפה מאותו מספר/מייל בתוך דקה, וכותבת דרך Admin SDK
 * כדי שלא ייפתח שום נתיב כתיבה ציבורי ב-Firestore.
 *
 * עד היום הטופס הציג "תודה, נחזור אליכם" בלי לשלוח כלום לשום מקום — כל פנייה
 * שנכנסה דרך האתר פשוט אבדה.
 */
// enforceAppCheck: true מאומת ידנית מול הסביבה החיה — קריאה מ-easyhall.vercel.app
// עברה עם verifications.app === "VALID" בלוגים לפני שהאכיפה הופעלה, כך שהפעלתה
// לא צפויה לחסום משתמשים אמיתיים.
export const submitSiteLead = onCall({ secrets: [resendApiKey], enforceAppCheck: true }, async (request) => {
  // הפונקציה הזו חייבת להיות פתוחה בלי התחברות — מי שממלא את הטופס הוא
  // לקוח פוטנציאלי בלי חשבון. זה בדיוק מה שהופך אותה ליעד להצפה: תוקף
  // שמשנה טלפון/מייל בכל קריאה עוקף גם את המלכודת וגם את חסימת הכפילות
  // למטה. הגבלת קצב לפי IP היא קו ההגנה שלא תלוי בתוכן הבקשה בכלל.
  await enforceRateLimit({
    key: `siteLead:${callerIp(request.rawRequest)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: "יותר מדי פניות מהכתובת הזו — נסו שוב בעוד שעה.",
  });

  const name = String(request.data?.name ?? "").trim().slice(0, 120);
  const email = String(request.data?.email ?? "").trim().toLowerCase().slice(0, 200);
  const phoneRaw = String(request.data?.phone ?? "").trim().slice(0, 40);
  const phone = phoneRaw.replace(/[\s()-]/g, "");
  // שדה מלכודת: בוטים ממלאים כל input, אדם אמיתי לא רואה אותו כלל.
  const honeypot = String(request.data?.company ?? "").trim();

  if (honeypot) {
    // לא מסגירים לבוט שזוהה — מחזירים תשובה זהה להצלחה.
    return { ok: true };
  }
  if (!name) {
    throw new HttpsError("invalid-argument", "יש להזין שם.");
  }
  if (!email && !phone) {
    throw new HttpsError("invalid-argument", "יש להזין אימייל או טלפון.");
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    throw new HttpsError("invalid-argument", "כתובת האימייל לא תקינה.");
  }
  if (phone && !IL_PHONE.test(phone)) {
    throw new HttpsError("invalid-argument", "מספר הטלפון לא תקין.");
  }

  // מניעת הצפה: אותה פנייה בדיוק בתוך דקה נחשבת לשליחה כפולה ומתעלמים ממנה.
  // קריאת מסמך בודד לפי id, לא query עם שני where — כך שאין תלות באינדקס
  // מורכב (הגרסה הקודמת עם .where().where() קרסה בפרודקשן על חוסר אינדקס,
  // וכל שליחה מהאתר נכשלה בשקט).
  const dedupeKey = (phone || email).replace(/[^a-z0-9@.+]/gi, "").slice(0, 200);
  const dedupeRef = db().collection("rateLimits").doc(`siteLeadDedupe_${dedupeKey}`);
  const dedupeSnap = await dedupeRef.get();
  const now = Date.now();
  const dedupeUntil = (dedupeSnap.data()?.resetAt as Timestamp | undefined)?.toMillis() ?? 0;
  if (dedupeUntil > now) {
    return { ok: true };
  }
  await dedupeRef.set({ resetAt: Timestamp.fromMillis(now + 60_000) });

  await db().collection("siteLeads").add({
    name,
    email: email || null,
    phone: phone || null,
    dedupeKey,
    status: "new",
    createdAt: FieldValue.serverTimestamp(),
  });

  const apiKey = resendApiKey.value();
  const from = emailFrom.value().trim();
  // הפנייה כבר נשמרה — כשל בשליחת המייל לא אמור להיראות למי שמילא את הטופס.
  if (!apiKey || !from) return { ok: true };

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `EasyHall אתר <${from}>`,
        to: [SITE_LEAD_ALERT_EMAIL],
        replyTo: email || undefined,
        subject: `פנייה חדשה מהאתר — ${name}`,
        html: `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;padding:20px;font-size:15px;">
          <p style="margin:0 0 14px;"><strong>${escapeHtml(name)}</strong> השאיר/ה פרטים בדף הנחיתה:</p>
          <p style="margin:0 0 6px;">טלפון: ${phone ? `<a href="tel:${escapeHtml(phone)}" dir="ltr">${escapeHtml(phone)}</a>` : "—"}</p>
          <p style="margin:0;">אימייל: ${email ? `<a href="mailto:${escapeHtml(email)}" dir="ltr">${escapeHtml(email)}</a>` : "—"}</p>
        </div>`,
      }),
    });
  } catch {
    // התרעה היא נחמד-שיהיה; הפנייה כבר שמורה ב-siteLeads.
  }

  return { ok: true };
});
