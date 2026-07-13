/**
 * Grow (לשעבר משולם / Meshulam) — מתאם סליקה.
 *
 * כל אולם מחבר את חשבון ה-Grow שלו (userId + pageCode) דרך מסך ההגדרות,
 * והפרטים נשמרים ב-organizations/{orgId}/private/payment — נגישים רק
 * מהשרת (Admin SDK), אף פעם לא ללקוח.
 *
 * צורת ה-API לפי התיעוד הרשמי: https://grow-il.readme.io/
 * שדות התגובה המדויקים ייאומתו מול חשבון אמיתי בעת החיבור הראשון —
 * המבנה כאן תואם לתיעוד + לשדות המוכרים של Meshulam Light API.
 */

export interface GrowCredentials {
  userId: string;
  pageCode: string;
  /** true = סביבת sandbox של Grow (לבדיקות לפני חיבור אמיתי) */
  sandbox?: boolean;
  /** סוד שאנחנו מייצרים; מוטמע ב-notifyUrl כדי לאמת שה-webhook באמת מ-Grow */
  webhookSecret: string;
}

export interface CreatePaymentLinkParams {
  amountIls: number;
  description: string;
  payerFullName: string;
  payerPhone: string;
  /** מזהים שלנו שחוזרים אלינו ב-webhook (cField1/cField2) */
  orgId: string;
  leadId: string;
  notifyUrl: string;
  successUrl: string;
  cancelUrl: string;
}

const GROW_BASE = {
  production: "https://secure.meshulam.co.il/api/light/server/1.0",
  sandbox: "https://sandbox.meshulam.co.il/api/light/server/1.0",
};

interface GrowCreateResponse {
  status: number; // 1 = הצלחה
  err?: { message?: string };
  data?: { url?: string; processId?: number; processToken?: string };
}

export async function createGrowPaymentLink(
  credentials: GrowCredentials,
  params: CreatePaymentLinkParams
): Promise<{ url: string }> {
  const base = credentials.sandbox ? GROW_BASE.sandbox : GROW_BASE.production;

  // ה-API של Grow מקבל form-encoded, לא JSON.
  const body = new URLSearchParams({
    userId: credentials.userId,
    pageCode: credentials.pageCode,
    sum: params.amountIls.toFixed(2),
    description: params.description,
    chargeType: "1",
    "pageField[fullName]": params.payerFullName,
    "pageField[phone]": params.payerPhone,
    cField1: params.orgId,
    cField2: params.leadId,
    notifyUrl: params.notifyUrl,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
  });

  const res = await fetch(`${base}/createPaymentProcess`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Grow HTTP ${res.status}`);
  }

  const json = (await res.json()) as GrowCreateResponse;
  if (json.status !== 1 || !json.data?.url) {
    throw new Error(json.err?.message || "Grow החזיר תשובה לא תקינה");
  }

  return { url: json.data.url };
}
