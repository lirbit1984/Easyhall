import type { EventContact, EventType } from "./types";

interface TitledEvent {
  contacts: EventContact[] | undefined;
  custom_title?: string | null;
}

function byRole(contacts: EventContact[] | undefined, role: string): EventContact | undefined {
  return contacts?.find((c) => c.role_key === role);
}

/**
 * כותרת הכרטיס: דריסה ידנית (custom_title) אם קיימת, אחרת מחושבת אוטומטית
 * מתפקידי אנשי הקשר. eventType אופציונלי — כשלא סופק (או לא נמצא), נופלים
 * חזרה לחיבור-שמות גנרי לפי סדר התפקידים המוכר.
 */
export function getEventTitle(lead: TitledEvent, eventType?: EventType): string {
  if (lead.custom_title && lead.custom_title.trim()) return lead.custom_title.trim();

  const { contacts } = lead;
  const bride = byRole(contacts, "bride");
  const groom = byRole(contacts, "groom");
  if (bride && groom) return `${bride.name} & ${groom.name}`;
  if (bride) return bride.name;
  if (groom) return groom.name;

  const celebrant = byRole(contacts, "celebrant");
  if (celebrant) {
    const typeName = eventType?.name;
    if (typeName === "בר מצווה") return `בר מצווה ל${celebrant.name}`;
    if (typeName === "בת מצווה") return `בת מצווה ל${celebrant.name}`;
    if (typeName === "בר/בת מצווה") return `בר/בת מצווה ל${celebrant.name}`;
    if (typeName === "ברית") return `ברית ל${celebrant.name}`;
    if (typeName === "יום הולדת") return `יום הולדת ל${celebrant.name}`;
    return celebrant.name;
  }

  const company = byRole(contacts, "company_name");
  if (company) return company.name;

  const parent = byRole(contacts, "parent");
  if (parent) return parent.name;

  return contacts?.[0]?.name ?? "ליד חדש";
}

export function primaryPhone(lead: { contacts: EventContact[] | undefined }): string {
  return lead.contacts?.[0]?.phone ?? "";
}

export function primaryContactName(lead: { contacts: EventContact[] | undefined }): string {
  return lead.contacts?.[0]?.name ?? "";
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

export function smsLink(phone: string): string {
  return `sms:${phone.replace(/[^\d+]/g, "")}`;
}

export function mailLink(email: string): string {
  return `mailto:${email}`;
}

const WEEKDAY_LABELS = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"];

export function formatWeekday(iso: string | null | undefined): string {
  if (!iso) return "—";
  return WEEKDAY_LABELS[new Date(iso).getDay()];
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}
