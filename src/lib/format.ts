import type { PartnerGender } from "./types";

interface NamedPartners {
  partner_1_name: string;
  partner_2_name: string;
  partner_1_gender?: PartnerGender;
  partner_2_gender?: PartnerGender;
}

/**
 * מחזיר את שני שמות בני הזוג בסדר התצוגה הנכון — הכלה תמיד ראשונה כשצוין
 * במפורש חתן+כלה. בזוגות חד-מיניים או כשהמגדר לא צוין, נשמר סדר ההזנה
 * המקורי (partner_1 ואז partner_2), כדי לא "לנחש" מי אמור להיות ראשון.
 */
export function orderedPartnerNames(lead: NamedPartners): [string, string] {
  if (lead.partner_1_gender === "groom" && lead.partner_2_gender === "bride") {
    return [lead.partner_2_name, lead.partner_1_name];
  }
  return [lead.partner_1_name, lead.partner_2_name];
}

export function coupleDisplayName(lead: NamedPartners): string {
  const [first, second] = orderedPartnerNames(lead);
  return `${first} & ${second}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function waLink(phone: string, message?: string): string {
  const clean = phone.replace(/[^\d]/g, "").replace(/^0/, "972");
  const base = `https://wa.me/${clean}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}
