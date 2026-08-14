"use client";

import { useMemo } from "react";
import { TrendingUp, Users, Wallet, Timer } from "lucide-react";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { LEAD_SOURCES } from "@/lib/mock-data";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { PIPELINE_STAGES } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

const SOURCE_COLORS = [
  "#6366f1",
  "#ec4899",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
];

export function BiDashboard() {
  const leads = useLeadsStore((s) => s.leads);
  const activity = useLeadsStore((s) => s.activity);
  const { members } = useOrgMembers();
  const { orgDoc } = useOrgDoc();
  const leadSources = orgDoc?.leadSources?.length ? orgDoc.leadSources : LEAD_SOURCES;

  const kpis = useMemo(() => {
    const total = leads.length;
    const closedWon = leads.filter((l) => l.pipeline_stage === "closed_won");
    const conversionRate = total ? (closedWon.length / total) * 100 : 0;
    const revenue = closedWon.reduce((sum, l) => sum + l.estimated_guests * l.price_per_plate, 0);

    const closeDurations: number[] = [];
    for (const lead of closedWon) {
      const closeEvent = activity
        .filter(
          (a) =>
            a.lead_id === lead.lead_id &&
            a.activity_type === "status_change" &&
            (a.content.includes("סגור") || a.content.includes("Closed Won"))
        )
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      if (closeEvent) {
        const days =
          (new Date(closeEvent.created_at).getTime() - new Date(lead.created_at).getTime()) /
          (1000 * 60 * 60 * 24);
        if (days >= 0) closeDurations.push(days);
      }
    }
    const avgCloseDays = closeDurations.length
      ? closeDurations.reduce((a, b) => a + b, 0) / closeDurations.length
      : null;

    return { total, conversionRate, revenue, avgCloseDays };
  }, [leads, activity]);

  const funnel = useMemo(
    () =>
      PIPELINE_STAGES.map((s) => ({
        ...s,
        count: leads.filter((l) => l.pipeline_stage === s.key).length,
      })),
    [leads]
  );
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  const leaderboard = useMemo(() => {
    return members
      .filter((u) => u.role !== "office")
      .map((u) => {
        const repLeads = leads.filter((l) => l.assigned_user_id === u.user_id);
        const closed = repLeads.filter((l) => l.pipeline_stage === "closed_won");
        const revenue = closed.reduce((sum, l) => sum + l.estimated_guests * l.price_per_plate, 0);
        return {
          user: u,
          totalLeads: repLeads.length,
          closedCount: closed.length,
          conversion: repLeads.length ? (closed.length / repLeads.length) * 100 : 0,
          revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [leads, members]);

  const sourceDistribution = useMemo(() => {
    const total = leads.length || 1;
    return leadSources.map((src, i) => {
      const count = leads.filter((l) => l.lead_source === src).length;
      return { source: src, count, pct: (count / total) * 100, color: SOURCE_COLORS[i % SOURCE_COLORS.length] };
    })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [leads, leadSources]);

  const lostReasons = useMemo(() => {
    const lost = leads.filter((l) => l.status === "not_relevant");
    const counts = new Map<string, number>();
    for (const l of lost) {
      const reason = l.lost_reason?.trim() || "לא צויינה סיבה";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    const total = lost.length || 1;
    return {
      totalLost: lost.length,
      rows: [...counts.entries()]
        .map(([reason, count]) => ({ reason, count, pct: (count / total) * 100 }))
        .sort((a, b) => b.count - a.count),
    };
  }, [leads]);

  const kpiCards = [
    { label: "סה\"כ לידים", value: `${kpis.total}`, icon: Users },
    { label: "אחוז המרה", value: `${kpis.conversionRate.toFixed(1)}%`, icon: TrendingUp },
    { label: "הכנסות חתומות", value: formatCurrency(kpis.revenue), icon: Wallet },
    {
      label: "זמן סגירה ממוצע",
      value: kpis.avgCloseDays !== null ? `${kpis.avgCloseDays.toFixed(0)} ימים` : "—",
      icon: Timer,
    },
  ];

  return (
    <>
      <div className="grid gap-3.5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {kpiCards.map((k) => {
            const Icon = k.icon;
            return (
              <BlueprintBox key={k.label}>
                <div className="flex items-center justify-between">
                  <BoxKicker className="mb-0">{k.label}</BoxKicker>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="mt-2 font-heading text-[28px] font-semibold">{k.value}</div>
              </BlueprintBox>
            );
          })}
        </div>

        <div className="grid gap-3.5 lg:grid-cols-2">
          {/* Funnel chart */}
          <BlueprintBox>
            <BoxKicker>משפך המרה</BoxKicker>
            <div className="grid gap-2.5">
              {funnel.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{f.label}</span>
                    <span className="text-muted-foreground">{f.count}</span>
                  </div>
                  <div className="h-2.5 bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(f.count / funnelMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </BlueprintBox>

          {/* Source distribution */}
          <BlueprintBox>
            <BoxKicker>מקורות לידים</BoxKicker>
            <div>
              {sourceDistribution.map((s) => (
                <div
                  key={s.source}
                  className="flex items-center justify-between border-t border-border py-2 text-[19.5px]"
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2.5" style={{ background: s.color }} />
                    {s.source}
                  </span>
                  <span className="text-muted-foreground">
                    {s.count} ({s.pct.toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </BlueprintBox>

          {/* Loss reasons — מבדל ייחודי: זיכרון מוסדי על למה לידים נופלים */}
          <BlueprintBox>
            <BoxKicker>סיבות אובדן לידים ({lostReasons.totalLost})</BoxKicker>
            {lostReasons.rows.length === 0 ? (
              <p className="py-2 text-[19.5px] text-muted-foreground">
                אין עדיין לידים שסומנו כ&quot;לא רלוונטי&quot;.
              </p>
            ) : (
              <div>
                {lostReasons.rows.map((r) => (
                  <div
                    key={r.reason}
                    className="flex items-center justify-between border-t border-border py-2 text-[19.5px]"
                  >
                    <span>{r.reason}</span>
                    <span className="text-muted-foreground">
                      {r.count} ({r.pct.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </BlueprintBox>
        </div>

        {/* Leaderboard */}
        <BlueprintBox className="min-w-0 p-0">
          <div className="p-[18px] pb-3">
            <BoxKicker className="mb-0">דוח ביצועי אנשי מכירות</BoxKicker>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">נציג</th>
                  <th className="p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">סה&quot;כ לידים</th>
                  <th className="p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">נסגרו</th>
                  <th className="p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">אחוז המרה</th>
                  <th className="p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">הכנסות</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => (
                  <tr key={row.user.user_id} className="border-b border-border/60">
                    <td className="flex items-center gap-2 p-2.5">
                      {i === 0 && <span title="מוביל/ה">🏆</span>}
                      {row.user.full_name}
                    </td>
                    <td className="p-2.5">{row.totalLeads}</td>
                    <td className="p-2.5">{row.closedCount}</td>
                    <td className="p-2.5">{row.conversion.toFixed(0)}%</td>
                    <td className="p-2.5 font-medium">{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BlueprintBox>
      </div>
    </>
  );
}
