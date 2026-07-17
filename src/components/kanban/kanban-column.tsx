"use client";

import { useDroppable } from "@dnd-kit/core";
import type { LeadEvent, PipelineStage } from "@/lib/types";
import { LeadCard } from "./lead-card";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  stage,
  label,
  leads,
  onOpenLead,
}: {
  stage: PipelineStage;
  label: string;
  leads: LeadEvent[];
  onOpenLead: (leadId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="flex w-[82vw] max-w-80 shrink-0 flex-col sm:w-72 sm:max-w-none">
      <div className="flex items-center justify-between border-b border-border pb-1.5">
        <h3
          className="text-[12.5px] tracking-[.04em] uppercase"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {label}
        </h3>
        <span className="border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3 transition-colors",
          isOver && "bg-primary/5 ring-2 ring-inset ring-primary/30"
        )}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.lead_id} lead={lead} onOpen={onOpenLead} />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            אין לידים בשלב זה
          </div>
        )}
      </div>
    </div>
  );
}
