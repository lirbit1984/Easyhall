// הופך תאריך מחושב לשורות עגלה: שורת מחיר מנה ושורה לכל תוספת פעילה.
import type { CartLineItem, LeadEvent } from "@/lib/types";
import type { Pricing, PricingOption } from "./types";
import { compute, isOn, unitPrice, costOf, seasonOf } from "./engine";

export const CALC_PREFIX = "px_";
export const isCalcLine = (l: CartLineItem) => l.item_id.startsWith(CALC_PREFIX);

export function linesFromOption(P: Pricing, opt: PricingOption, g: number): CartLineItem[] {
  const r = compute(P, opt, g);
  const lines: CartLineItem[] = [
    { item_id: CALC_PREFIX + "plate", label: "מחיר מנה", unit: "per_guest", quantity: g, price_override: r.base, vat_mode: "included" },
  ];
  for (const a of P.addons) {
    if (!isOn(a, opt.st) || !r.cost[a.id]) continue;
    const perGuest = a.unit === "person";
    lines.push({
      item_id: CALC_PREFIX + a.id,
      label: a.name,
      unit: perGuest ? "per_guest" : "fixed",
      quantity: perGuest ? g : 1,
      price_override: perGuest ? unitPrice(P, a, opt.month, opt.st) : costOf(P, a, opt.month, g, opt.st),
      vat_mode: "included",
    });
  }
  return lines;
}

// מחירי שורות של תאריך נוסף, להצעה עם כמה תאריכים (QuoteOptionalDate.price_overrides)
export function overridesFromOption(P: Pricing, opt: PricingOption, g: number): Record<string, number> {
  return Object.fromEntries(linesFromOption(P, opt, g).map((l) => [l.item_id, l.price_override ?? 0]));
}

// מחירי סגירה בעבר: לכל אירוע שנסגר, התאריך שנסגר (מהצעה שאושרה, או מהמחשבון
// בכרטיס סגור ישן) ומחיר המנה שסוכם. משמש להראות לנציג במה נמכרו אירועים
// באותה עונה ובאותו יום.
export interface PastDeal { leadId: string; month: number; day: number; guests: number; base: number; list: number | null }

export function pastDeals(P: Pricing, leads: LeadEvent[]): PastDeal[] {
  return leads.flatMap((l) => {
    const won = l.quotes?.find((q) => q.status === "won" && q.closed_index != null);
    const opt = won ? won.options[won.closed_index!] : l.status === "closed" ? l.pricing_calc?.options[0] : undefined;
    const guests = won ? won.guests : l.pricing_calc?.guests ?? 0;
    if (!opt || opt.month == null || opt.day == null || !guests) return [];
    const r = compute(P, opt, guests);
    return r.ok ? [{ leadId: l.lead_id, month: opt.month, day: opt.day, guests, base: r.base, list: r.list }] : [];
  });
}

export function similarDeals(P: Pricing, deals: PastDeal[], month: number | null, day: number | null, exceptLead: string) {
  const season = seasonOf(P, month);
  if (!season || day == null) return null;
  const same = deals.filter((d) => d.leadId !== exceptLead && d.day === day && season.months.includes(d.month));
  if (!same.length) return null;
  const pct = (d: PastDeal) => (d.list ? ((d.base - d.list) / d.list) * 100 : 0);
  const lowest = same.reduce((a, b) => (pct(b) < pct(a) ? b : a));
  return { season: season.name, count: same.length, lowest, lowestPct: pct(lowest), avgPct: same.reduce((s, d) => s + pct(d), 0) / same.length };
}
