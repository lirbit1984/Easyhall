"use client";

import { useMemo } from "react";
import { TrendingUp, Users, Wallet, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeadsStore } from "@/store/use-leads-store";
import { LEAD_SOURCES } from "@/lib/mock-data";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
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
    return LEAD_SOURCES.map((src, i) => {
      const count = leads.filter((l) => l.lead_source === src).length;
      return { source: src, count, pct: (count / total) * 100, color: SOURCE_COLORS[i % SOURCE_COLORS.length] };
    })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  return (
    <div className="grid gap-4 p-3 sm:p-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">סה&quot;כ לידים</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{kpis.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">אחוז המרה</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{kpis.conversionRate.toFixed(1)}%</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">הכנסות חתומות</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatCurrency(kpis.revenue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">זמן סגירה ממוצע</CardTitle>
            <Timer className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {kpis.avgCloseDays !== null ? `${kpis.avgCloseDays.toFixed(0)} ימים` : "—"}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funnel chart */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">משפך המרות</h3>
          <div className="grid gap-2">
            {funnel.map((f) => (
              <div key={f.key} className="grid grid-cols-[110px_1fr_2rem] items-center gap-2 text-xs">
                <span className="truncate text-muted-foreground">{f.label}</span>
                <div className="h-4 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary transition-all"
                    style={{ width: `${(f.count / funnelMax) * 100}%` }}
                  />
                </div>
                <span className="text-right font-medium">{f.count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Source distribution */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">התפלגות מקורות הגעה</h3>
          <div className="grid gap-2">
            {sourceDistribution.map((s) => (
              <div key={s.source} className="grid grid-cols-[110px_1fr_3rem] items-center gap-2 text-xs">
                <span className="truncate text-muted-foreground">{s.source}</span>
                <div className="h-4 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded"
                    style={{ width: `${s.pct}%`, background: s.color }}
                  />
                </div>
                <span className="text-right font-medium">{s.count} ({s.pct.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="overflow-hidden p-0">
        <div className="p-4 pb-0">
          <h3 className="mb-3 text-sm font-semibold">דוח ביצועי אנשי מכירות</h3>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="p-2 text-right font-medium">נציג</th>
              <th className="p-2 text-right font-medium">סה&quot;כ לידים</th>
              <th className="p-2 text-right font-medium">נסגרו</th>
              <th className="p-2 text-right font-medium">אחוז המרה</th>
              <th className="p-2 text-right font-medium">הכנסות</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row, i) => (
              <tr key={row.user.user_id} className="border-t">
                <td className="flex items-center gap-2 p-2">
                  {i === 0 && <span title="מוביל/ה">🏆</span>}
                  {row.user.full_name}
                </td>
                <td className="p-2">{row.totalLeads}</td>
                <td className="p-2">{row.closedCount}</td>
                <td className="p-2">{row.conversion.toFixed(0)}%</td>
                <td className="p-2 font-medium">{formatCurrency(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
