import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";

// getFirestore() נקרא בתוך ההנדלר (לא בטעינת המודול) כדי שה-initializeApp()
// שב-index.ts יספיק לרוץ קודם, בלי תלות בסדר ה-imports.
const db = () => getFirestore();

/**
 * שליחת מסמכים לזוג מהשרת דרך Resend.
 *
 * הדרך הקודמת (mailto / חלון חיבור של Gmail) תלויה בהגדרות הדפדפן של הנציג —
 * איזו תוכנת דואר מותקנת, לאיזה חשבון גוגל הוא מחובר. כאן המייל יוצא מהשרת
 * בשם האולם, בלי שום הגדרה בצד הלקוח.
 *
 * דורש שני משתני סביבה. עד שהם מוגדרים הפונקציה מחזירה שגיאה ברורה, וה-UI
 * ממשיך להציע את אפשרויות השיתוף הישנות:
 *   RESEND_API_KEY   — מפתח ה-API מחשבון Resend (secret)
 *   EMAIL_FROM       — כתובת שולח על דומיין מאומת ב-Resend, למשל docs@easyhall.co.il
 */
const resendApiKey = defineSecret("RESEND_API_KEY");
const emailFrom = defineString("EMAIL_FROM", { default: "" });

type OrgRole = "admin" | "sales_rep" | "office";

interface DocumentRef {
  doc_id: string;
  name: string;
  url: string;
  short_url?: string;
}

interface EventContact {
  name?: string;
  email?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(venueName: string, contactName: string, docName: string, url: string): string {
  const venue = escapeHtml(venueName);
  const contact = escapeHtml(contactName);
  const name = escapeHtml(docName);
  return `<!doctype html>
<html dir="rtl" lang="he">
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
      <p style="margin:0 0 16px;font-size:16px;">שלום ${contact},</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
        מצורף המסמך <strong>${name}</strong> מ${venue}.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${url}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;">
          צפייה במסמך
        </a>
      </p>
      <p style="margin:0 0 4px;font-size:12px;color:#78716c;">אם הכפתור לא עובד, אפשר להעתיק את הקישור:</p>
      <p style="margin:0 0 24px;font-size:12px;color:#78716c;word-break:break-all;" dir="ltr">${url}</p>
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:0 0 16px;" />
      <p style="margin:0;font-size:12px;color:#78716c;">${venue}</p>
    </div>
  </body>
</html>`;
}

export const sendDocumentEmail = onCall({ secrets: [resendApiKey] }, async (request) => {
  const orgId = String(request.data?.orgId ?? "").trim();
  const leadId = String(request.data?.leadId ?? "").trim();
  const docId = String(request.data?.docId ?? "").trim();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  if (!orgId || !leadId || !docId) {
    throw new HttpsError("invalid-argument", "חסרים פרטי המסמך לשליחה.");
  }

  const apiKey = resendApiKey.value();
  const from = emailFrom.value().trim();
  if (!apiKey || !from) {
    throw new HttpsError(
      "failed-precondition",
      "שליחת מייל מהמערכת עדיין לא הוגדרה. יש להגדיר דומיין מאומת ב-Resend."
    );
  }

  const memberSnap = await db()
    .collection("organizations")
    .doc(orgId)
    .collection("members")
    .doc(request.auth.uid)
    .get();
  if (!memberSnap.exists) {
    throw new HttpsError("permission-denied", "אינך חבר בארגון זה.");
  }
  // אותה הרשאה כמו בשאר פעולות המסמכים בכרטיס: משרד לא שולח מסמכים לזוג.
  const role = (memberSnap.data()?.role ?? "sales_rep") as OrgRole;
  if (role === "office") {
    throw new HttpsError("permission-denied", "אין לך הרשאה לשלוח מסמכים לזוג.");
  }

  const orgRef = db().collection("organizations").doc(orgId);
  const [orgSnap, leadSnap] = await Promise.all([orgRef.get(), orgRef.collection("leads").doc(leadId).get()]);
  if (!leadSnap.exists) {
    throw new HttpsError("not-found", "כרטיס האירוע לא נמצא.");
  }

  const lead = leadSnap.data() as { contacts?: EventContact[]; email?: string; documents?: DocumentRef[] };
  const document = lead.documents?.find((d) => d.doc_id === docId);
  if (!document) {
    throw new HttpsError("not-found", "המסמך לא נמצא בכרטיס.");
  }

  const recipient = (lead.contacts?.[0]?.email ?? lead.email ?? "").trim();
  if (!recipient) {
    throw new HttpsError("failed-precondition", "לא נמצאה כתובת מייל לזוג.");
  }

  const org = orgSnap.data() as { name?: string; venueEmail?: string } | undefined;
  const venueName = org?.name ?? "האולם";
  const contactName = lead.contacts?.[0]?.name ?? "";
  const url = document.short_url ?? document.url;

  const payload: Record<string, unknown> = {
    // שם התצוגה הוא שם האולם, כך שהזוג רואה ממי זה הגיע גם כשהדומיין משותף
    // לכל האולמות במערכת.
    from: `${venueName} <${from}>`,
    to: [recipient],
    subject: document.name,
    html: buildHtml(venueName, contactName, document.name, url),
  };
  // תשובה של הזוג צריכה להגיע לאולם עצמו, לא לכתובת המערכת.
  if (org?.venueEmail) payload.reply_to = org.venueEmail;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpsError("internal", `שליחת המייל נכשלה (${res.status}). ${detail}`.trim());
  }

  // התיעוד נכתב מהשרת ולא מהלקוח, כך שהוא משקף שליחה שבאמת יצאה.
  const activityRef = orgRef.collection("activity").doc();
  await activityRef.set({
    activity_id: activityRef.id,
    lead_id: leadId,
    user_id: request.auth.uid,
    activity_type: "note",
    content: `נשלח מסמך "${document.name}" במייל ל${contactName || recipient}.`,
    created_at: new Date().toISOString(),
  });

  return { success: true, recipient };
});
