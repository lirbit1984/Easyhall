"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { compute, normalizePricing, yehudaDefaults } from "@/lib/pricing/engine";
import { primaryContactName } from "@/lib/format";

/**
 * עמלות מתוך הצעות שנסגרו ("סגור תאריך זה"). כל תאריך שנסגר = עסקה:
 * הסכום הוא עלות האירוע מהמחשבון, האחוז נשמר בזמן הסגירה, והחודש הוא חודש הסגירה.
 * נציג רואה רק את שלו; admin והנהלת חשבונות רואים הכול ומסמנים "שולמה".
 */
const nis = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (k: string) => new Date(k + "-01").toLocaleDateString("he-IL", { month: "long", year: "numeric" });
const fmt = (iso: string) => new Date(iso).toLocaleDateString("he-IL");

interface Row {
  leadId: string; quoteId: string; couple: string; rep: string; closedAt: string;
  eventDate: string | null; amount: number; rate: number; commission: number; paid: boolean;
}

export function Commissions() {
  const leads = useLeadsStore((s) => s.leads);
  const setLeadQuotes = useLeadsStore((s) => s.setLeadQuotes);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const role = useCurrentRole();
  const manager = role === "admin" || role === "accounting";
  const { members } = useOrgMembers();
  const { orgDoc } = useOrgDoc();
  const P = useMemo(() => (orgDoc?.pricing ? normalizePricing(orgDoc.pricing) : yehudaDefaults()), [orgDoc?.pricing]);
  const [repFilter, setRepFilter] = useState("");

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const l of leads) for (const q of l.quotes ?? []) {
      if (q.status !== "won" || q.closed_index == null) continue;
      const o = q.options[q.closed_index];
      if (!o) continue;
      const amount = compute(P, o, q.guests).total;
      const rate = q.commission_rate ?? P.commission;
      out.push({
        leadId: l.lead_id, quoteId: q.quote_id, couple: primaryContactName(l), rep: q.closed_by || l.assigned_user_id,
        closedAt: q.closed_at || q.updated_at || q.sent_at, eventDate: o.exact ?? null,
        amount, rate, commission: Math.round(amount * rate) / 100, paid: !!q.commission_paid,
      });
    }
    return out.sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  }, [leads, P]);

  const visible = rows.filter((r) => (manager ? !repFilter || r.rep === repFilter : r.rep === currentUserId));
  const repName = (id: string) => members.find((m) => m.user_id === id)?.full_name || "—";
  const now = new Date().toISOString();
  const sum = (rs: Row[]) => rs.reduce((t, r) => t + r.commission, 0);
  const kpis = [
    ["החודש", sum(visible.filter((r) => monthKey(r.closedAt) === monthKey(now)))],
    ["השנה", sum(visible.filter((r) => r.closedAt.slice(0, 4) === now.slice(0, 4)))],
    ["הכול", sum(visible)],
    ["טרם שולם", sum(visible.filter((r) => !r.paid))],
  ] as const;
  const months = [...new Set(visible.map((r) => monthKey(r.closedAt)))];
  const reps = [...new Set(rows.map((r) => r.rep))];

  const togglePaid = (r: Row) => {
    const l = leads.find((x) => x.lead_id === r.leadId);
    if (l) setLeadQuotes(l.lead_id, (l.quotes ?? []).map((q) => (q.quote_id === r.quoteId ? { ...q, commission_paid: !r.paid } : q)));
  };

  // CSV עם BOM — נפתח באקסל בעברית תקינה
  const exportMonth = (k: string) => {
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["איש מכירות", "זוג", "תאריך סגירה", "תאריך אירוע", "סכום", "אחוז", "עמלה", "שולמה"],
      ...visible.filter((r) => monthKey(r.closedAt) === k).map((r) => [
        repName(r.rep), r.couple, fmt(r.closedAt), r.eventDate ? fmt(r.eventDate) : "", r.amount, r.rate, r.commission, r.paid ? "כן" : "לא",
      ]),
    ];
    const blob = new Blob(["﻿" + lines.map((x) => x.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `עמלות-${k}.csv`;
    a.click();
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(([label, v]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-semibold">{nis(v)}</div>
          </div>
        ))}
      </div>

      {manager && reps.length > 1 && (
        <select className="w-fit rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={repFilter} onChange={(e) => setRepFilter(e.target.value)}>
          <option value="">כל אנשי המכירות</option>
          {reps.map((id) => <option key={id} value={id}>{repName(id)}</option>)}
        </select>
      )}

      {months.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          עדיין אין תאריכים שנסגרו. סוגרים תאריך בלשונית &quot;הצעות מחיר&quot; בכרטיס האירוע.
        </div>
      )}

      {months.map((k) => {
        const rs = visible.filter((r) => monthKey(r.closedAt) === k);
        return (
          <section key={k} className="rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <b>{monthLabel(k)}</b>
              <div className="flex items-center gap-3 text-sm">
                <span>{rs.length} עסקאות · {nis(sum(rs))}</span>
                <Button size="sm" variant="outline" onClick={() => exportMonth(k)}><Download className="size-3.5" />אקסל</Button>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="text-right">
                    {manager && <th className="px-3 py-1.5 font-normal">איש מכירות</th>}
                    <th className="px-3 py-1.5 font-normal">זוג</th>
                    <th className="px-3 py-1.5 font-normal">נסגר</th>
                    <th className="px-3 py-1.5 font-normal">אירוע</th>
                    <th className="px-3 py-1.5 font-normal">סכום</th>
                    <th className="px-3 py-1.5 font-normal">עמלה</th>
                    <th className="px-3 py-1.5 font-normal">שולמה</th>
                  </tr>
                </thead>
                <tbody>
                  {rs.map((r) => (
                    <tr key={r.quoteId} className="border-t border-border">
                      {manager && <td className="px-3 py-1.5">{repName(r.rep)}</td>}
                      <td className="px-3 py-1.5">{r.couple}</td>
                      <td className="px-3 py-1.5">{fmt(r.closedAt)}</td>
                      <td className="px-3 py-1.5">{r.eventDate ? fmt(r.eventDate) : "—"}</td>
                      <td className="px-3 py-1.5">{nis(r.amount)}</td>
                      <td className="px-3 py-1.5">{nis(r.commission)} <span className="text-xs text-muted-foreground">({r.rate}%)</span></td>
                      <td className="px-3 py-1.5">
                        {manager ? <input type="checkbox" checked={r.paid} onChange={() => togglePaid(r)} /> : r.paid ? "כן" : "לא"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
