"use client";

import { useDraggable } from "@dnd-kit/core";
import { Users, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RepAvatar } from "@/components/leads/rep-avatar";
import { QuickActions } from "@/components/leads/quick-actions";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import type { LeadEvent } from "@/lib/types";
import { formatDate, isOverdue, isToday, getEventTitle, primaryPhone, primaryContactName } from "@/lib/format";
import { useLeadsStore } from "@/store/use-leads-store";
import { cn } from "@/lib/utils";

export function LeadCard({
  lead,
  onOpen,
}: {
  lead: LeadEvent;
  onOpen: (leadId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.lead_id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const overdue = isOverdue(lead.follow_up_at);
  const dueToday = isToday(lead.follow_up_at);
  const { members } = useOrgMembers();
  const openedBy = members.find((m) => m.user_id === lead.created_by_user_id)?.full_name;
  const eventType = useLeadsStore((s) => s.eventTypes.find((t) => t.event_type_id === lead.event_type_id));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(lead.lead_id)}
      className={cn(
        "aurora-card flex h-full cursor-pointer flex-col gap-2.5 p-3.5",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <span className="aurora-glow" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-[15px] font-semibold">
            {getEventTitle(lead, eventType)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" />
              {formatDate(lead.event_date)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {lead.estimated_guests}
            </span>
          </div>
        </div>
        <RepAvatar userId={lead.assigned_user_id} size="sm" />
      </div>

      <p className="text-[11px] text-muted-foreground">
        נפתח {formatDate(lead.created_at)}
        {openedBy && ` ע״י ${openedBy}`}
      </p>

      {lead.follow_up_at && (
        <Badge
          variant={overdue ? "destructive" : dueToday ? "default" : "secondary"}
          className={cn(
            "w-fit rounded-full text-[11px]",
            !overdue && "bg-accent text-accent-foreground"
          )}
        >
          פולו-אפ: {formatDate(lead.follow_up_at)}
          {overdue && " (באיחור)"}
          {dueToday && !overdue && " (היום)"}
        </Badge>
      )}

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="truncate text-[11px] text-muted-foreground">{lead.lead_source}</span>
        <QuickActions leadId={lead.lead_id} phone={primaryPhone(lead)} partnerName={primaryContactName(lead)} />
      </div>
    </div>
  );
}
