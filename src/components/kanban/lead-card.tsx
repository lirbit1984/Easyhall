"use client";

import { useDraggable } from "@dnd-kit/core";
import { Users, CalendarDays, CircleDollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { EventTypeIcon } from "@/components/event-type-icon";
import { QuickActions } from "@/components/leads/quick-actions";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import type { LeadEvent } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import { formatDate, formatCurrency, isOverdue, isToday, getEventTitle, primaryPhone, primaryContactName } from "@/lib/format";
import { useLeadsStore } from "@/store/use-leads-store";
import { cn } from "@/lib/utils";

function daysOverdue(dueDate: string): number {
  const diffMs = new Date().setHours(0, 0, 0, 0) - new Date(dueDate).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

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
  const overduePayment = (lead.payment_schedule ?? [])
    .filter((s) => !s.is_paid && isOverdue(s.due_date))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
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
      {overduePayment && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="absolute top-2 left-2 z-10 flex size-[22px] items-center justify-center rounded-full bg-destructive/15"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <CircleDollarSign className="size-3.5 text-destructive" />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {overduePayment.label} באיחור — {formatCurrency(overduePayment.amount)} · {daysOverdue(overduePayment.due_date)} ימים
          </TooltipContent>
        </Tooltip>
      )}
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-[15px] font-semibold">
            {getEventTitle(lead, eventType)}
          </p>
          {eventType && (
            <span
              className="mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white"
              style={{ background: eventType.color ?? "var(--muted-foreground)" }}
            >
              {eventType.name}
            </span>
          )}
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          {eventType && (
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full"
              style={{ background: eventType.color ? `${eventType.color}26` : "var(--muted)" }}
            >
              <EventTypeIcon
                icon={eventType.icon}
                className="size-3.5"
                style={{ color: eventType.color ?? "var(--muted-foreground)" }}
              />
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
              lead.status === "potential" && "bg-amber-500/15 text-amber-700",
              lead.status === "not_relevant" && "bg-muted text-muted-foreground",
              lead.status === "closed" && "bg-green-500/15 text-green-700"
            )}
          >
            {STATUS_LABELS[lead.status]}
          </span>
        </div>
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
