"use client";

import { useMemo, useState } from "react";
import { Phone, MessageCircle, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { formatDateTime, isOverdue, isToday, telLink, waLink } from "@/lib/format";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterKey = "mine" | "today" | "overdue" | "team";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "mine", label: "המטלות שלי" },
  { key: "today", label: "היום" },
  { key: "overdue", label: "באיחור" },
  { key: "team", label: "מטלות צוות" },
];

export function TaskCenter() {
  const tasks = useLeadsStore((s) => s.tasks);
  const leads = useLeadsStore((s) => s.leads);
  const toggleTask = useLeadsStore((s) => s.toggleTask);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const { members } = useOrgMembers();

  const [filter, setFilter] = useState<FilterKey>("mine");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (filter === "mine") return t.assigned_user_id === currentUserId;
        if (filter === "today") return isToday(t.due_date) && !t.is_completed;
        if (filter === "overdue") return isOverdue(t.due_date) && !t.is_completed;
        return true; // team
      })
      .sort((a, b) => {
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
  }, [tasks, filter, currentUserId]);

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">לוח מטלות</h2>
        <Tabs value={filter} onValueChange={(v) => v && setFilter(v as FilterKey)}>
          <TabsList className="w-full overflow-x-auto sm:w-auto">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="shrink-0">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 p-2" />
              <th className="p-2 text-right font-medium">משימה</th>
              <th className="p-2 text-right font-medium">ליד מקושר</th>
              <th className="p-2 text-right font-medium">אחראי</th>
              <th className="p-2 text-right font-medium">יעד</th>
              <th className="w-24 p-2 text-right font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const lead = leads.find((l) => l.lead_id === t.lead_id);
              const overdue = !t.is_completed && isOverdue(t.due_date);
              const assignee = members.find((m) => m.user_id === t.assigned_user_id);
              return (
                <tr key={t.task_id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <Checkbox checked={t.is_completed} onCheckedChange={() => toggleTask(t.task_id)} />
                  </td>
                  <td
                    className={cn(
                      "p-2",
                      t.is_completed && "text-muted-foreground line-through"
                    )}
                  >
                    {t.title}
                  </td>
                  <td className="p-2">
                    {lead ? (
                      <button
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={() => setOpenLeadId(lead.lead_id)}
                      >
                        {lead.partner_1_name} & {lead.partner_2_name}
                        <ExternalLink className="size-3" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground">{assignee?.full_name}</td>
                  <td className={cn("p-2", overdue && "font-medium text-destructive")}>
                    {formatDateTime(t.due_date)}
                    {overdue && (
                      <Badge variant="destructive" className="mr-1.5 text-[10px]">
                        באיחור
                      </Badge>
                    )}
                  </td>
                  <td className="p-2">
                    {lead && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="חייג"
                          onClick={() => (window.location.href = telLink(lead.phone_primary))}
                        >
                          <Phone className="size-3.5 text-blue-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="שלח WhatsApp"
                          onClick={() =>
                            window.open(waLink(lead.phone_primary), "_blank", "noopener,noreferrer")
                          }
                        >
                          <MessageCircle className="size-3.5 text-green-600" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  אין משימות להצגה בתצוגה זו.
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
