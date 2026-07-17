"use client";

import { useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { KanbanBody } from "@/components/kanban/kanban-board";
import { LeadsTableBody } from "@/components/leads/leads-table";
import { useBoardView, type BoardView } from "@/lib/use-board-view";
import { cn } from "@/lib/utils";

/**
 * דף הדשבורד: מאחד את תצוגת הקנבאן ותצוגת הטבלה תחת מתג אחד. הכותרת,
 * ה-LeadDrawer והמתג משותפים; רק הגוף מתחלף לפי הבחירה (שנשמרת בדפדפן).
 */
export function DashboardView() {
  const { view, setView } = useBoardView();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  return (
    <div className="p-3 sm:p-6">
      <PageHeader
        title="צנרת מכירות"
        subtitle={view === "kanban" ? "כל הזוגות בתהליך — גררו כרטיס לעדכון סטטוס" : "כל הזוגות במקום אחד"}
        actions={<ViewToggle view={view} onChange={setView} />}
      />

      {view === "kanban" ? (
        <KanbanBody onOpenLead={setOpenLeadId} />
      ) : (
        <LeadsTableBody onOpenLead={setOpenLeadId} />
      )}

      <LeadDrawer leadId={openLeadId} onOpenChange={(open) => !open && setOpenLeadId(null)} />
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: BoardView; onChange: (v: BoardView) => void }) {
  return (
    <div className="flex shrink-0 border border-border">
      <ToggleButton active={view === "kanban"} onClick={() => onChange("kanban")}>
        <LayoutGrid className="size-4" />
        <span className="hidden sm:inline">קנבאן</span>
      </ToggleButton>
      <ToggleButton active={view === "table"} onClick={() => onChange("table")}>
        <Table2 className="size-4" />
        <span className="hidden sm:inline">טבלה</span>
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
