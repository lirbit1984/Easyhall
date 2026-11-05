// הופך תאריך מחושב לשורות עגלה: שורת מחיר מנה ושורה לכל תוספת פעילה.
import type { CartLineItem } from "@/lib/types";
import type { Pricing, PricingOption } from "./types";
import { compute, isOn, unitPrice, costOf } from "./engine";

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
