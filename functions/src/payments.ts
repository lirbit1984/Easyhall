import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { createGrowPaymentLink, type GrowCredentials } from "./grow";

// getFirestore() נקרא בתוך ההנדלרים (לא בזמן טעינת המודול) כדי שה-initializeApp()
// שב-index.ts יספיק לרוץ קודם, בלי תלות בסדר ה-imports.
const db = () => getFirestore();

type OrgRole = "admin" | "sales_rep" | "office";

async function requireOrgMember(
  auth: { uid: string } | undefined,
  orgId: string
): Promise<{ uid: string; role: OrgRole }> {
  if (!auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  if (!orgId) {
    throw new HttpsError("invalid-argument", "חסר מזהה ארגון.");
  }
  const memberSnap = await db()
    .collection("organizations")
    .doc(orgId)
    .collection("members")
    .doc(auth.uid)
    .get();
  if (!memberSnap.exists) {
    throw new HttpsError("permission-denied", "אינך חבר בארגון זה.");
  }
  return { uid: auth.uid, role: (memberSnap.data()?.role ?? "sales_rep") as OrgRole };
}

/**
 * שמירת פרטי החיבור ל-Grow של אולם ספציפי (admin בלבד).
 * הסודות יושבים ב-private/payment שאין אליו שום גישת לקוח (rules: deny all);
 * על מסמך הארגון הציבורי נשמר רק דגל paymentConnected לתצוגה ב-UI.
 */
export const setPaymentCredentials = onCall(async (request) => {
  const orgId = String(request.data?.orgId ?? "").trim();
  const { role } = await requireOrgMember(request.auth, orgId);
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "רק מנהל יכול לחבר סליקה.");
  }

  const growUserId = String(request.data?.growUserId ?? "").trim();
  const growPageCode = String(request.data?.growPageCode ?? "").trim();
  const sandbox = Boolean(request.data?.sandbox);

  if (!growUserId || !growPageCode) {
    throw new HttpsError("invalid-argument", "יש למלא userId ו-pageCode מחשבון ה-Grow.");
  }

  const orgRef = db().collection("organizations").doc(orgId);
  const privateRef = orgRef.collection("private").doc("payment");
  const existing = await privateRef.get();
  // סוד ה-webhook נשמר יציב בין עדכוני פרטים, כדי לא לשבור notifyUrl-ים
  // שכבר הוטמעו בקישורי תשלום פתוחים.
  const webhookSecret: string = existing.data()?.webhookSecret ?? randomUUID();

  const batch = db().batch();
  batch.set(privateRef, {
    provider: "grow",
    userId: growUserId,
    pageCode: growPageCode,
    sandbox,
    webhookSecret,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(orgRef, { paymentConnected: true, paymentProvider: "grow" }, { merge: true });
  await batch.commit();

  return { ok: true };
});

/**
 * יצירת קישור תשלום אמיתי למקדמה של ליד. רץ בשרת כי פרטי ה-Grow סודיים.
 * הקישור נשמר על הליד + נרשמת פעילות; סימון "מקדמה שולמה" קורה רק
 * כשה-webhook מ-Grow מאשר תשלום בפועל.
 */
export const createPaymentLink = onCall(async (request) => {
  const orgId = String(request.data?.orgId ?? "").trim();
  await requireOrgMember(request.auth, orgId);

  const leadId = String(request.data?.leadId ?? "").trim();
  const amountIls = Number(request.data?.amountIls ?? 0);
  const description = String(request.data?.description ?? "מקדמה לאירוע").trim();

  if (!leadId || !Number.isFinite(amountIls) || amountIls <= 0) {
    throw new HttpsError("invalid-argument", "חסרים ליד או סכום תקין.");
  }

  const orgRef = db().collection("organizations").doc(orgId);
  const [credsSnap, leadSnap] = await Promise.all([
    orgRef.collection("private").doc("payment").get(),
    orgRef.collection("leads").doc(leadId).get(),
  ]);

  if (!credsSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "האולם עדיין לא חובר לסליקה. מנהל יכול לחבר חשבון Grow במסך ההגדרות."
    );
  }
  if (!leadSnap.exists) {
    throw new HttpsError("not-found", "הליד לא נמצא.");
  }

  const creds = credsSnap.data() as GrowCredentials;
  const lead = leadSnap.data() as {
    contacts?: { name: string; phone?: string }[];
  };

  const projectId = process.env.GCLOUD_PROJECT ?? "easy-hall";
  const notifyUrl =
    `https://us-central1-${projectId}.cloudfunctions.net/growWebhook` +
    `?orgId=${encodeURIComponent(orgId)}&secret=${encodeURIComponent(creds.webhookSecret)}`;

  const { url } = await createGrowPaymentLink(creds, {
    amountIls,
    description,
    payerFullName: (lead.contacts ?? []).map((c) => c.name).join(" ").trim() || "לקוח",
    payerPhone: lead.contacts?.[0]?.phone ?? "",
    orgId,
    leadId,
    notifyUrl,
    successUrl: "https://easyhall.app/payment-success",
    cancelUrl: "https://easyhall.app/payment-cancelled",
  });

  const batch = db().batch();
  batch.update(orgRef.collection("leads").doc(leadId), { payment_link: url });
  batch.set(orgRef.collection("activity").doc(), {
    lead_id: leadId,
    type: "note",
    content: `נוצר קישור לתשלום מקדמה על סך ₪${amountIls.toLocaleString("he-IL")}.`,
    created_at: new Date().toISOString(),
    created_by: request.auth!.uid,
  });
  await batch.commit();

  return { url };
});

/**
 * Webhook שרת-לשרת מ-Grow על תשלום שהושלם.
 * אימות: Grow לא חותמת בקשות, לכן ה-notifyUrl שאנחנו שולחים כולל סוד
 * ייחודי לארגון — בקשה בלי הסוד הנכון נדחית.
 */
export const growWebhook = onRequest(async (req, res) => {
  try {
    const orgId = String(req.query.orgId ?? "");
    const secret = String(req.query.secret ?? "");
    if (!orgId || !secret) {
      res.status(400).send("missing params");
      return;
    }

    const orgRef = db().collection("organizations").doc(orgId);
    const credsSnap = await orgRef.collection("private").doc("payment").get();
    if (!credsSnap.exists || credsSnap.data()?.webhookSecret !== secret) {
      res.status(403).send("forbidden");
      return;
    }

    // Grow שולחת form-encoded או JSON, תלוי בהגדרת החשבון — תומכים בשניהם.
    const payload = (typeof req.body === "object" && req.body) || {};
    const leadId = String(payload.cField2 ?? payload.customFields?.cField2 ?? "");
    const paymentSum = Number(payload.paymentSum ?? payload.sum ?? 0);
    const transactionCode = String(payload.transactionCode ?? payload.transactionId ?? "");

    if (!leadId) {
      // נשמר לוג גולמי כדי שנוכל לכייל את מבנה ה-payload מול חשבון אמיתי.
      await orgRef.collection("private").doc("lastWebhookPayload").set({
        receivedAt: FieldValue.serverTimestamp(),
        payload: JSON.stringify(payload).slice(0, 5000),
      });
      res.status(200).send("ok (no leadId)");
      return;
    }

    const batch = db().batch();
    batch.update(orgRef.collection("leads").doc(leadId), {
      deposit_paid: true,
      deposit_paid_at: new Date().toISOString(),
      deposit_transaction: transactionCode,
    });
    batch.set(orgRef.collection("activity").doc(), {
      lead_id: leadId,
      type: "note",
      content: `המקדמה שולמה בפועל דרך Grow${paymentSum ? ` (₪${paymentSum.toLocaleString("he-IL")})` : ""}. אסמכתא: ${transactionCode || "—"}`,
      created_at: new Date().toISOString(),
      created_by: "system",
    });
    await batch.commit();

    res.status(200).send("ok");
  } catch (err) {
    console.error("growWebhook failed", err);
    res.status(500).send("error");
  }
});
