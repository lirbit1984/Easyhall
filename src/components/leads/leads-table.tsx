"use client";

import { useMemo } from "react";
import { Phone } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { Badge } from "@/components/ui/badge";
import { useLeadsStore } from "@/store/use-leads-store";
import { useFiltersStore } from "@/store/use-filters-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { PIPELINE_STAGES } from "@/lib/types";
import { formatDate, isOverdue, telLink, waLink } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * גוף טבלת הלידים בלבד. הכותרת, המרווח וה-LeadDrawer מנוהלים ע"י
 * DashboardView שעוטף אותה, כדי לחלוק אותם עם תצוגת הקנבאן.
 */
export function LeadsTableBody({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const leads = useLeadsStore((s) => s.leads);
  const { search, repFilter, sourceFilter } = useFiltersStore();
  const { members } = useOrgMembers();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (repFilter !== "all" && l.assigned_user_id !== repFilter) return false;
      if (sourceFilter !== "all" && l.lead_source !== sourceFilter) return false;
      if (q) {
        const haystack = `${l.partner_1_name} ${l.partner_2_name} ${l.phone_primary}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, repFilter, sourceFilter]);

  return (
    <div className="blueprint relative overflow-x-auto border border-border">
        <i className="corner tl" />
        <i className="corner tr" />
        <i className="corner bl" />
        <i className="corner br" />
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">זוג</th>
              <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">שלב</th>
              <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">תאריך אירוע</th>
              <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">מוזמנים</th>
              <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">נציג</th>
              <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">מקור</th>
              <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">פולו-אפ</th>
              <th className="w-20 p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const stage = PIPELINE_STAGES.find((s) => s.key === l.pipeline_stage);
              const overdue = l.follow_up_at && isOverdue(l.follow_up_at);
              return (
                <tr key={l.lead_id} className="border-b border-border/60 hover:bg-foreground/[.04]">
                  <td className="p-2.5">
                    <button
                      className="text-accent-foreground hover:underline"
                      onClick={() => onOpenLead(l.lead_id)}
                    >
                      {l.partner_1_name} & {l.partner_2_name}
                    </button>
                  </td>
                  <td className="p-2.5">
                    <Badge variant="outline" className="rounded-none">{stage?.label}</Badge>
                  </td>
                  <td className="p-2.5">{formatDate(l.event_date)}</td>
                  <td className="p-2.5">{l.estimated_guests}</td>
                  <td className="p-2.5 text-muted-foreground">
                    {members.find((m) => m.user_id === l.assigned_user_id)?.full_name}
                  </td>
                  <td className="p-2.5 text-muted-foreground">{l.lead_source}</td>
                  <td className="p-2.5">
                    {l.follow_up_at ? (
                      <Badge
                        variant={overdue ? "destructive" : "secondary"}
                        className={cn("rounded-none", !overdue && "bg-accent text-accent-foreground")}
                      >
                        {formatDate(l.follow_up_at)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="חייג"
                        onClick={() => (window.location.href = telLink(l.phone_primary))}
                      >
                        <Phone className="size-3.5 text-blue-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="שלח WhatsApp"
                        onClick={() =>
                          window.open(waLink(l.phone_primary), "_blank", "noopener,noreferrer")
                        }
                      >
                        <WhatsappIcon className="size-3.5 text-green-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  לא נמצאו לידים תואמים.
                </td>
              </tr>
            )}
          </tbody>
        </table>
    </div>
  );
}
