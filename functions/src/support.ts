import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";

const db = () => getFirestore();

// אותם secrets/פרמטרים כמו sendDocumentEmail — Resend, דומיין מאומת.
const resendApiKey = defineSecret("RESEND_API_KEY");
const emailFrom = defineString("EMAIL_FROM", { default: "" });

/** לירן — היחיד שמקבל התרעת מייל על פנייה חדשה. */
const SUPPORT_ALERT_EMAIL = "peanuts.rlz@gmail.com";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * כל הודעת צ'אט תמיכה חדשה (מכל ארגון) מעדכנת את מסמך התקציר
 * supportThreads/{orgId} (כדי שמסך הניהול יוכל למיין/לרשום את כל הפניות
 * בשאילתה אחת בלי לתת ללקוח לכתוב את זה ישירות), ואם השולח הוא משתמש
 * (לא לירן עצמו) — שולחת מייל התרעה, כדי שלירן ידע גם כשהוא לא ליד המסך.
 */
export const onSupportMessageCreated = onDocumentCreated(
  { document: "supportThreads/{orgId}/messages/{messageId}", secrets: [resendApiKey] },
  async (event) => {
    const orgId = event.params.orgId;
    const msg = event.data?.data() as
      | { sender?: "user" | "admin"; sender_name?: string; text?: string; created_at?: string }
      | undefined;
    if (!msg) return;

    const orgSnap = await db().collection("organizations").doc(orgId).get();
    const orgName = (orgSnap.data()?.name as string | undefined) ?? orgId;

    await db()
      .collection("supportThreads")
      .doc(orgId)
      .set(
        {
          orgId,
          orgName,
          lastMessageAt: msg.created_at ?? new Date().toISOString(),
          lastMessageText: msg.text ?? "",
          lastMessageSender: msg.sender ?? "user",
        },
        { merge: true }
      );

    if (msg.sender !== "user") return;

    const apiKey = resendApiKey.value();
    const from = emailFrom.value().trim();
    if (!apiKey || !from) return; // עדיין לא הוגדר מייל שרת — הצ'אט עצמו לא נחסם בגלל זה

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `EasyHall תמיכה <${from}>`,
          to: [SUPPORT_ALERT_EMAIL],
          subject: `פנייה חדשה בתמיכה — ${orgName}`,
          html: `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;padding:20px;">
            <p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(msg.sender_name ?? "")}</strong> מ-${escapeHtml(orgName)} כתב/ה:</p>
            <p style="margin:0;font-size:15px;white-space:pre-wrap;">${escapeHtml(msg.text ?? "")}</p>
          </div>`,
        }),
      });
    } catch {
      // מייל ההתרעה הוא נחמד-שיהיה, לא קריטי — כישלון שליחה לא אמור להפיל את הפונקציה.
    }
  }
);
