"use client";

import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { LeadCard } from "./lead-card";
import { useLeadsStore } from "@/store/use-leads-store";
import { useFiltersStore } from "@/store/use-filters-store";
import { PIPELINE_STAGES } from "@/lib/types";
import type { PipelineStage } from "@/lib/types";

/**
 * גוף לוח הקנבאן בלבד (עמודות + גרירה). הכותרת, המרווח וה-LeadDrawer
 * מנוהלים ע"י DashboardView שעוטף אותו, כדי לחלוק אותם עם תצוגת הטבלה.
 */
export function KanbanBody({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const leads = useLeadsStore((s) => s.leads);
  const updateLeadStage = useLeadsStore((s) => s.updateLeadStage);
  const addActivity = useLeadsStore((s) => s.addActivity);
  const { search, repFilter, sourceFilter } = useFiltersStore();

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (repFilter !== "all" && l.assigned_user_id !== repFilter) return false;
      if (sourceFilter !== "all" && l.lead_source !== sourceFilter) return false;
      if (q) {
        const haystack = `${l.partner_1_name} ${l.partner_2_name} ${l.phone_primary} ${
          l.event_date ?? ""
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, repFilter, sourceFilter]);

  const activeLead = activeId ? leads.find((l) => l.lead_id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const leadId = active.id as string;
    const newStage = over.id as PipelineStage;
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead || lead.pipeline_stage === newStage) return;

    updateLeadStage(leadId, newStage);
    const fromLabel = PIPELINE_STAGES.find((s) => s.key === lead.pipeline_stage)?.label;
    const toLabel = PIPELINE_STAGES.find((s) => s.key === newStage)?.label;
    addActivity(leadId, "status_change", `סטטוס שונה: ${fromLabel} ➔ ${toLabel}.`);
    toast.success(`הליד הועבר ל"${toLabel}"`);
  }

  return (
    <DndContext
      id="kanban-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 sm:snap-none *:snap-start">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage.key}
            stage={stage.key}
            label={stage.label}
            leads={filteredLeads.filter((l) => l.pipeline_stage === stage.key)}
            onOpenLead={onOpenLead}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <LeadCard lead={activeLead} onOpen={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
