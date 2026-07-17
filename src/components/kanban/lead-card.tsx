"use client";

import { useDraggable } from "@dnd-kit/core";
import { Users, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RepAvatar } from "@/components/leads/rep-avatar";
import { QuickActions } from "@/components/leads/quick-actions";
import type { LeadEvent } from "@/lib/types";
import { formatDate, isOverdue, isToday, coupleDisplayName } from "@/lib/format";
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(lead.lead_id)}
      className={cn(
        "blueprint cursor-pointer gap-2.5 rounded-none border border-border bg-transparent p-3 shadow-sm ring-0 transition-shadow hover:shadow-md",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-heading text-[15px] font-semibold">
            {coupleDisplayName(lead)}
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

      {lead.follow_up_at && (
        <Badge
          variant={overdue ? "destructive" : dueToday ? "default" : "secondary"}
          className={cn(
            "w-fit rounded-none text-[11px]",
            !overdue && "bg-accent text-accent-foreground"
          )}
        >
          פולו-אפ: {formatDate(lead.follow_up_at)}
          {overdue && " (באיחור)"}
          {dueToday && !overdue && " (היום)"}
        </Badge>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="truncate text-[11px] text-muted-foreground">{lead.lead_source}</span>
        <QuickActions leadId={lead.lead_id} phone={lead.phone_primary} partnerName={lead.partner_1_name} />
      </div>
    </Card>
  );
}
