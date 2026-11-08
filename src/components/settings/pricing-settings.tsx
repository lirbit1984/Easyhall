"use client";

// הגדרות המחירון של מחשבון המנה: כללי, תקופות, טבלת מחירים לפי מדרגה ויום, ותוספות.
// כללים, מבצעים וחללים נשמרים כמו שהם (עריכה שלהם — בשלב הבא).
import { useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { cn } from "@/lib/utils";
import type { AddonUnit, Pricing, PricingAddon } from "@/lib/pricing/types";
import { DAY_NAMES, MONTHS, normalizePricing, yehudaDefaults } from "@/lib/pricing/engine";

const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const uid = () => Math.random().toString(36).slice(2, 8);
const UNITS: [AddonUnit, string][] = [["event", "לאירוע"], ["person", "לאורח"], ["table", "לשולחן"]];

export function PricingSettings() {
  const { orgDoc } = useOrgDoc();
  const setOrgPricing = useLeadsStore((s) => s.setOrgPricing);
  const [P, setP] = useState<Pricing>(() => (orgDoc?.pricing ? normalizePricing(orgDoc.pricing) : yehudaDefaults()));
  const [seasonTab, setSeasonTab] = useState(P.seasons[0]?.id ?? "");

  const edit = (f: (d: Pricing) => void) => setP((p) => { const d = structuredClone(p); f(d); return d; });
  const save = () => {
    const clean = normalizePricing(P);
    const orphan = MONTHS.filter((_, i) => !clean.seasons.some((s) => s.months.includes(i + 1)));
    setOrgPricing(clean);
    toast.success(orphan.length ? `נשמר. חודשים בלי תקופה: ${orphan.join(", ")}` : "המחירון נשמר");
  };
  const reset = () => {
    if (!confirm("להחזיר למחירון יהודה המקורי? השינויים שלא נשמרו יימחקו.")) return;
    const d = yehudaDefaults();
    setP(d);
    setSeasonTab(d.seasons[0].id);
  };
  const setAddon = (id: string, p: Partial<PricingAddon>) =>
    edit((d) => { const a = d.addons.find((x) => x.id === id); if (a) Object.assign(a, p); });

  const season = P.seasons.find((s) => s.id === seasonTab);
  const cell = "h-8 w-20 text-sm";

  return (
    <div className="grid gap-3.5">
      <BlueprintBox className="grid gap-3">
        <BoxKicker>כללי</BoxKicker>
        <div className="flex flex-wrap gap-4 text-sm">
          {([["minGuests", "מינימום אורחים"], ["guestsPerTable", "אורחים לשולחן"], ["commission", "עמלה %"], ["tierBreak", "נקודת שבר בין מדרגות %"], ["approvalPct", "הנחה שדורשת אישור מנהל % (0 = ללא)"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2">{l}
              <Input type="number" className={cell} value={P[k]} onChange={(e) => edit((d) => { d[k] = num(e.target.value) ?? 0; })} />
            </label>
          ))}
        </div>
        <label className="flex flex-wrap items-center gap-2 text-sm">מדרגות אורחים
          <Input className="h-8 w-60" defaultValue={P.brackets.join(", ")} key={P.brackets.join()}
            onBlur={(e) => edit((d) => { d.brackets = e.target.value.split(/[,\s]+/).map(Number).filter((n) => n > 0).sort((a, b) => a - b); })} />
          <span className="text-xs text-muted-foreground">מופרדות בפסיק</span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">ימים
          {DAY_NAMES.map((n, d) => (
            <button key={d} type="button" onClick={() => edit((x) => { x.days = x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d].sort(); })}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs", P.days.includes(d) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{n}</button>
          ))}
        </div>
      </BlueprintBox>

      <BlueprintBox className="grid gap-3">
        <div className="flex items-center justify-between">
          <BoxKicker className="mb-0">תקופות ומחירי מנה</BoxKicker>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { const id = "s" + uid(); edit((d) => { d.seasons.push({ id, name: "תקופה חדשה", months: [] }); }); setSeasonTab(id); }}>
            <Plus className="size-3.5" />תקופה
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {P.seasons.map((s) => (
            <button key={s.id} type="button" onClick={() => setSeasonTab(s.id)}
              className={cn("rounded-md border px-3 py-1 text-sm", s.id === seasonTab ? "border-primary bg-primary/10 text-primary" : "border-border")}>{s.name}</button>
          ))}
        </div>
        {season && (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Input className="h-8 w-40" value={season.name} onChange={(e) => edit((d) => { d.seasons.find((s) => s.id === season.id)!.name = e.target.value; })} />
              {P.seasons.length > 1 && (
                <button type="button" className="text-xs text-destructive underline" onClick={() => {
                  if (!confirm(`למחוק את "${season.name}"?`)) return;
                  edit((d) => { d.seasons = d.seasons.filter((s) => s.id !== season.id); delete d.table[season.id]; });
                  setSeasonTab(P.seasons.find((s) => s.id !== season.id)!.id);
                }}>מחק תקופה</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {MONTHS.map((m, i) => {
                const owner = P.seasons.find((s) => s.months.includes(i + 1));
                const mine = owner?.id === season.id;
                return (
                  <button key={m} type="button" title={owner && !mine ? `שייך ל${owner.name}` : ""}
                    onClick={() => edit((d) => { d.seasons.forEach((s) => { s.months = s.months.filter((x) => x !== i + 1); }); if (!mine) d.seasons.find((s) => s.id === season.id)!.months.push(i + 1); })}
                    className={cn("rounded-full border px-2 py-0.5 text-xs", mine ? "border-primary bg-primary/10 text-primary" : owner ? "border-border text-muted-foreground/50" : "border-dashed border-destructive text-destructive")}>{m}</button>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead><tr><th className="p-1 text-right font-normal text-muted-foreground">אורחים</th>{P.days.map((d) => <th key={d} className="p-1 font-normal text-muted-foreground">{DAY_NAMES[d]}</th>)}</tr></thead>
                <tbody>
                  {P.brackets.map((b) => (
                    <tr key={b}>
                      <td className="p-1 font-medium">{b}+</td>
                      {P.days.map((d) => (
                        <td key={d} className="p-1">
                          <Input type="number" className={cell} value={P.table[season.id]?.[b]?.[d] ?? ""}
                            onChange={(e) => edit((x) => { ((x.table[season.id] ??= {})[b] ??= {})[d] = num(e.target.value); })} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </BlueprintBox>

      <BlueprintBox className="grid gap-2">
        <div className="flex items-center justify-between">
          <BoxKicker className="mb-0">תוספות</BoxKicker>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => edit((d) => { d.groups.push({ id: "g" + uid(), name: "קבוצה חדשה", default: "" }); })}><Plus className="size-3.5" />קבוצה</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => edit((d) => { d.addons.push({ id: "a" + uid(), name: "תוספת חדשה", price: 0, unit: "event", group: "", on: false, monthPrices: {}, seasonPrices: {}, includedTables: 0, extraPerTable: 0 }); })}><Plus className="size-3.5" />תוספת</Button>
          </div>
        </div>
        {P.groups.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            קבוצות (בחירה אחת מתוך כמה):
            {P.groups.map((g) => (
              <span key={g.id} className="flex items-center gap-1">
                <Input className="h-7 w-28 text-xs" value={g.name} onChange={(e) => edit((d) => { d.groups.find((x) => x.id === g.id)!.name = e.target.value; })} />
                <button type="button" aria-label="מחק קבוצה" onClick={() => edit((d) => { d.groups = d.groups.filter((x) => x.id !== g.id); d.addons.forEach((a) => { if (a.group === g.id) a.group = ""; }); })}><Trash2 className="size-3.5 text-destructive" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="text-muted-foreground">
              <th className="p-1 text-right font-normal">שם</th><th className="p-1 text-right font-normal">מחיר</th><th className="p-1 text-right font-normal">יחידה</th>
              <th className="p-1 text-right font-normal">קבוצה</th><th className="p-1 text-right font-normal">ברירת מחדל</th><th className="p-1 text-right font-normal">עד שולחנות / לשולחן נוסף</th><th />
            </tr></thead>
            <tbody>
              {P.addons.map((a) => {
                const grp = P.groups.find((g) => g.id === a.group);
                return (
                  <tr key={a.id} className="border-t border-border/60">
                    <td className="p-1"><Input className="h-8 min-w-40 text-sm" value={a.name} onChange={(e) => setAddon(a.id, { name: e.target.value })} /></td>
                    <td className="p-1"><Input type="number" className={cell} value={a.price} onChange={(e) => setAddon(a.id, { price: num(e.target.value) ?? 0 })} /></td>
                    <td className="p-1">
                      <select className="h-8 rounded-md border border-border bg-background px-1" value={a.unit} onChange={(e) => setAddon(a.id, { unit: e.target.value as AddonUnit })}>
                        {UNITS.map(([u, l]) => <option key={u} value={u}>{l}</option>)}
                      </select>
                    </td>
                    <td className="p-1">
                      <select className="h-8 rounded-md border border-border bg-background px-1" value={a.group} onChange={(e) => setAddon(a.id, { group: e.target.value })}>
                        <option value="">עצמאית</option>
                        {P.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1 text-center">
                      {grp ? (
                        <input type="radio" name={`def-${grp.id}`} checked={grp.default === a.id} onChange={() => edit((d) => { d.groups.find((g) => g.id === grp.id)!.default = a.id; })} />
                      ) : (
                        <input type="checkbox" checked={a.on} onChange={(e) => setAddon(a.id, { on: e.target.checked })} />
                      )}
                    </td>
                    <td className="p-1">
                      <span className="flex gap-1">
                        <Input type="number" className="h-8 w-16 text-sm" value={a.includedTables || ""} onChange={(e) => setAddon(a.id, { includedTables: num(e.target.value) ?? 0 })} />
                        <Input type="number" className="h-8 w-16 text-sm" value={a.extraPerTable || ""} onChange={(e) => setAddon(a.id, { extraPerTable: num(e.target.value) ?? 0 })} />
                      </span>
                    </td>
                    <td className="p-1">
                      <button type="button" aria-label="מחק תוספת" onClick={() => confirm(`למחוק את "${a.name}"?`) && edit((d) => { d.addons = d.addons.filter((x) => x.id !== a.id); })}><Trash2 className="size-3.5 text-destructive" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BlueprintBox>

      <div className="flex flex-wrap gap-2">
        <Button className="gap-1.5" onClick={save}><Save className="size-3.5" />שמור מחירון</Button>
        <Button variant="outline" className="gap-1.5" onClick={reset}><RotateCcw className="size-3.5" />החזר למחירון יהודה המקורי</Button>
      </div>
    </div>
  );
}
