"use client";

// מחשבון מחיר מנה (מנוע יהודה) בתוך כרטיס האירוע. עד 4 תאריכים, לכל תאריך
// תוספות משלו; "הכנס לעגלה" שם את התאריך הראשון בעגלה כשורת מנה + שורה לכל
// תוספת, ותאריכים נוספים (עם תאריך מדויק) נשמרים כתאריכים אופציונליים להצעה.
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import type { LeadEvent, QuoteOptionalDate } from "@/lib/types";
import type { Pricing, PricingOption } from "@/lib/pricing/types";
import {
  DAY_NAMES, MONTHS, cloneState, compute, diffFromList, isOn, newAddonState,
  normalizePricing, unitPrice, yehudaDefaults,
} from "@/lib/pricing/engine";
import { CALC_PREFIX, isCalcLine, linesFromOption, overridesFromOption, pastDeals, similarDeals } from "@/lib/pricing/cart";

const MAX_DATES = 4;
const nis = (n: number) => "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 2 });
const numOrNull = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

function newOption(P: Pricing, from?: PricingOption): PricingOption {
  return { month: null, day: null, manual: null, target: null, ai: false, exact: null, st: from ? cloneState(from.st) : newAddonState(P) };
}

export interface CalcActionsCtx { P: Pricing; guests: number; opts: PricingOption[]; valid: boolean }

export function PricingCalculator({ lead, onDone, initial, renderActions }: {
  lead: LeadEvent;
  onDone?: () => void;
  // בלשונית הצעות מחיר: מצב התחלתי (עריכה/שכפול) וכפתורים משלה במקום "הכנס לעגלה"
  initial?: { guests: number; options: PricingOption[] };
  renderActions?: (ctx: CalcActionsCtx) => ReactNode;
}) {
  const { orgDoc } = useOrgDoc();
  const rawPricing = orgDoc?.pricing;
  const P = useMemo(() => (rawPricing ? normalizePricing(rawPricing) : yehudaDefaults()), [rawPricing]);
  const updateLeadCart = useLeadsStore((s) => s.updateLeadCart);
  const setOptionalDates = useLeadsStore((s) => s.setLeadQuoteOptionalDates);
  const saveCalc = useLeadsStore((s) => s.setLeadPricingCalc);
  const allLeads = useLeadsStore((s) => s.leads);
  const deals = useMemo(() => pastDeals(P, allLeads), [P, allLeads]);

  const [guests, setGuests] = useState<number>(initial?.guests ?? lead.pricing_calc?.guests ?? lead.estimated_guests ?? 0);
  const [opts, setOpts] = useState<PricingOption[]>(() => initial?.options ?? lead.pricing_calc?.options ?? [newOption(P)]);
  const [open, setOpen] = useState(opts.length - 1);

  const patch = (i: number, p: Partial<PricingOption>) => setOpts((o) => o.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const patchSt = (i: number, f: (st: PricingOption["st"]) => void) =>
    setOpts((o) => o.map((x, j) => { if (j !== i) return x; const st = cloneState(x.st); f(st); return { ...x, st }; }));

  const results = opts.map((o) => compute(P, o, guests));
  const ready = (i: number) => opts[i].month != null && opts[i].day != null && results[i].ok;

  const addDate = () => {
    if (opts.length >= MAX_DATES) return;
    setOpts((o) => [...o, newOption(P, o[open])]);
    setOpen(opts.length);
  };
  const removeDate = (i: number) => {
    if (!confirm(`להסיר את תאריך ${i + 1} מההצעה?`)) return;
    setOpts((o) => o.filter((_, j) => j !== i));
    setOpen(0);
  };

  const toCart = () => {
    if (!guests || !ready(0)) {
      toast.error("חסר מספר אורחים, חודש או יום בתאריך הראשון");
      return;
    }
    const keep = (lead.cart ?? []).filter((l) => !isCalcLine(l));
    updateLeadCart(lead.lead_id, [...linesFromOption(P, opts[0], guests), ...keep]);
    const extra: QuoteOptionalDate[] = opts.slice(1).flatMap((o, k) =>
      o.exact && ready(k + 1) ? [{ date_id: `${CALC_PREFIX}${k + 1}`, date: o.exact, price_overrides: overridesFromOption(P, o, guests) }] : []);
    const others = (lead.quote_optional_dates ?? []).filter((d) => !d.date_id.startsWith(CALC_PREFIX));
    setOptionalDates(lead.lead_id, [...others, ...extra]);
    saveCalc(lead.lead_id, { guests, options: opts });
    const skipped = opts.length - 1 - extra.length;
    toast.success(skipped > 0 ? `הוכנס לעגלה. ${skipped} תאריכים בלי תאריך מדויק לא נכנסו להצעה` : "הוכנס לעגלה");
    onDone?.();
  };

  return (
    <div className="grid gap-3 p-3">
      <label className="flex items-center gap-2 text-sm">
        כמות אורחים
        <Input type="number" min={0} value={guests || ""} onChange={(e) => setGuests(Math.max(0, Number(e.target.value) || 0))} className="h-8 w-24" />
        {guests > 0 && guests < P.minGuests && <span className="text-xs text-destructive">מינימום {P.minGuests}</span>}
      </label>

      {opts.map((o, i) => {
        const r = results[i];
        const diff = diffFromList(r.base, r.list);
        const title = o.month != null && o.day != null ? `${MONTHS[o.month - 1]} · ${DAY_NAMES[o.day]}${o.exact ? ` · ${o.exact.split("-").reverse().join(".")}` : ""}` : "תאריך חדש";
        const onAddons = P.addons.filter((a) => isOn(a, o.st) && r.cost[a.id]);
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-[var(--radius)] border border-border bg-card">
            <button type="button" className="flex w-full items-center justify-between gap-2 p-2.5 text-right" onClick={() => setOpen(isOpen ? -1 : i)}>
              <span className="font-medium">תאריך {i + 1}: {title}</span>
              <span className="flex items-center gap-2 text-sm">
                {ready(i) && <b>{nis(r.base)} למנה</b>}
                {isOpen ? <><ChevronUp className="size-4" />קפל</> : <ChevronDown className="size-4" />}
              </span>
            </button>

            {!isOpen && ready(i) && (
              <div className="border-t border-border px-2.5 py-2 text-xs text-muted-foreground">
                {onAddons.length ? onAddons.map((a) => `${a.name} ${nis(r.cost[a.id])}`).join(" · ") : "בלי תוספות"}
                {" · "}הכל כלול {nis(r.per)} למנה · {nis(r.total)} לאירוע
              </div>
            )}

            {isOpen && (
              <div className="grid gap-3 border-t border-border p-2.5">
                <div className="flex flex-wrap gap-2 text-sm">
                  <select className="h-8 rounded-md border border-border bg-background px-2" value={o.month ?? ""} onChange={(e) => patch(i, { month: numOrNull(e.target.value) })}>
                    <option value="">חודש</option>
                    {MONTHS.map((m, k) => <option key={k} value={k + 1}>{m}</option>)}
                  </select>
                  <select className="h-8 rounded-md border border-border bg-background px-2" value={o.day ?? ""} onChange={(e) => patch(i, { day: numOrNull(e.target.value) })}>
                    <option value="">יום</option>
                    {P.days.map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
                  </select>
                  <Input type="date" value={o.exact ?? ""} className="h-8 w-40" onChange={(e) => {
                    const v = e.target.value || null;
                    const d = v ? new Date(v + "T12:00") : null;
                    patch(i, d ? { exact: v, month: d.getMonth() + 1, day: d.getDay() } : { exact: null });
                  }} />
                  {P.spaces.length > 1 && (
                    <select className="h-8 rounded-md border border-border bg-background px-2" value={o.space ?? ""} onChange={(e) => patch(i, { space: e.target.value || undefined })}>
                      {P.spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>

                <div className="grid gap-1.5 text-sm sm:grid-cols-3">
                  <div>מחירון: <b>{r.list != null ? nis(r.list) : "—"}</b>
                    {r.rules.map((x) => <div key={x.id} className="text-xs text-primary">{x.name}</div>)}
                  </div>
                  <label className="flex items-center gap-1.5">סוכם
                    <Input type="number" disabled={r.fromTarget} value={r.fromTarget ? r.base : o.manual ?? ""} placeholder={r.list != null ? String(r.list) : ""}
                      onChange={(e) => patch(i, { manual: numOrNull(e.target.value) })} className="h-8 w-24" />
                    {diff && Math.abs(diff.pct) >= 0.05 && (
                      <span className={diff.d < 0 ? "text-xs text-destructive" : "text-xs text-emerald-600"}>{diff.pct > 0 ? "+" : ""}{diff.pct.toFixed(1)}%</span>
                    )}
                  </label>
                  <label className="flex items-center gap-1.5">הכל כלול
                    <Input type="number" value={o.target ?? ""} onChange={(e) => { const t = numOrNull(e.target.value); patch(i, { target: t, ai: t != null }); }} className="h-8 w-24" />
                  </label>
                  {r.fromTarget && r.base < 0 && <div className="text-xs text-destructive sm:col-span-3">התוספות עולות על התקציב</div>}
                  {(() => {
                    const h = similarDeals(P, deals, o.month, o.day, lead.lead_id);
                    if (!h) return null;
                    const sign = (x: number) => (x > 0 ? "+" : "") + x.toFixed(0) + "%";
                    return (
                      <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 sm:col-span-3">
                        {h.count === 1 ? "נסגר אירוע אחד" : `נסגרו ${h.count} אירועים`} ב{h.season} ביום {DAY_NAMES[o.day!]}: הנמוך {nis(h.lowest.base)} למנה ({sign(h.lowestPct)} מהמחירון, {h.lowest.guests} אורחים){h.count > 1 && ` · ממוצע ${sign(h.avgPct)}`}
                      </div>
                    );
                  })()}
                </div>

                <div className="grid gap-1 rounded-md bg-muted/40 p-2 text-sm">
                  {P.groups.map((g) => (
                    <label key={g.id} className="flex items-center justify-between gap-2">
                      {g.name}
                      <select className="h-7 rounded-md border border-border bg-background px-2" value={o.st.sel[g.id] ?? ""} onChange={(e) => patchSt(i, (st) => { st.sel[g.id] = e.target.value; })}>
                        <option value="">ללא</option>
                        {P.addons.filter((a) => a.group === g.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>
                  ))}
                  {P.addons.map((a) => {
                    const on = isOn(a, o.st);
                    if (a.group && !on) return null;
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5">
                          {!a.group && <input type="checkbox" checked={on} onChange={(e) => patchSt(i, (st) => { st.on[a.id] = e.target.checked; })} />}
                          <span className={on ? "" : "text-muted-foreground"}>{a.name}</span>
                        </label>
                        {on && (
                          <span className="flex items-center gap-1.5">
                            <Input type="number" className="h-7 w-24" value={unitPrice(P, a, o.month, o.st)}
                              onChange={(e) => patchSt(i, (st) => { const v = numOrNull(e.target.value); if (v == null) delete st.over[a.id]; else st.over[a.id] = v; })} />
                            <span className="w-32 whitespace-nowrap text-xs text-muted-foreground">{a.unit === "person" ? "לאורח" : a.unit === "table" ? "לשולחן" : "לאירוע"} · {nis(r.cost[a.id] ?? 0)}</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>הכל כלול <b>{nis(r.per)}</b> למנה · <b>{nis(r.total)}</b> לאירוע</span>
                  {opts.length > 1 && (
                    <button type="button" className="text-xs text-destructive underline" onClick={() => removeDate(i)}>הסר את תאריך {i + 1} מההצעה</button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {opts.length < MAX_DATES && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={addDate}><Plus className="size-3.5" />הוסף תאריך</Button>
        )}
        {renderActions
          ? renderActions({ P, guests, opts, valid: guests > 0 && opts.every((_, i) => ready(i)) })
          : <Button size="sm" className="gap-1.5" onClick={toCart}><ShoppingCart className="size-3.5" />הכנס לעגלה</Button>}
      </div>
    </div>
  );
}
