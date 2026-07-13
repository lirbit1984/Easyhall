"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLeadsStore } from "@/store/use-leads-store";
import { useFiltersStore } from "@/store/use-filters-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { PIPELINE_STAGES } from "@/lib/types";
import { formatDate, isOverdue, telLink, waLink } from "@/lib/format";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { Button } from "@/components/ui/button";

export function LeadsTable() {
  const leads = useLeadsStore((s) => s.leads);
  const { search, repFilter, sourceFilter } = useFiltersStore();
  const { members } = useOrgMembers();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

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
    <div className="p-3 sm:p-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="p-2 text-right font-medium">זוג</th>
              <th className="p-2 text-right font-medium">שלב</th>
              <th className="p-2 text-right font-medium">תאריך אירוע</th>
              <th className="p-2 text-right font-medium">מוזמנים</th>
              <th className="p-2 text-right font-medium">נציג</th>
              <th className="p-2 text-right font-medium">מקור</th>
              <th className="p-2 text-right font-medium">פולו-אפ</th>
              <th className="w-20 p-2 text-right font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const stage = PIPELINE_STAGES.find((s) => s.key === l.pipeline_stage);
              const overdue = l.follow_up_at && isOverdue(l.follow_up_at);
              return (
                <tr key={l.lead_id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <button
                      className="text-primary hover:underline"
                      onClick={() => setOpenLeadId(l.lead_id)}
                    >
                      {l.partner_1_name} & {l.partner_2_name}
                    </button>
                  </td>
                  <td className="p-2">
                    <Badge variant="secondary">{stage?.label}</Badge>
                  </td>
                  <td className="p-2">{formatDate(l.event_date)}</td>
                  <td className="p-2">{l.estimated_guests}</td>
                  <td className="p-2 text-muted-foreground">
                    {members.find((m) => m.user_id === l.assigned_user_id)?.full_name}
                  </td>
                  <td className="p-2 text-muted-foreground">{l.lead_source}</td>
                  <td className="p-2">
                    {l.follow_up_at ? (
                      <Badge variant={overdue ? "destructive" : "secondary"}>
                        {formatDate(l.follow_up_at)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
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
                        <MessageCircle className="size-3.5 text-green-600" />
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

      <LeadDrawer leadId={openLeadId} onOpenChange={(open) => !open && setOpenLeadId(null)} />
    </div>
  );
}
