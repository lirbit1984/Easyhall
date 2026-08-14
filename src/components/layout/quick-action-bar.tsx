"use client";

import { useState } from "react";
import { Plus, FileText, CalendarPlus, ListChecks } from "lucide-react";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { NewMeetingDialog } from "@/components/calendar/new-meeting-dialog";
import { PickLeadDialog } from "@/components/layout/pick-lead-dialog";
import { LeadDrawer } from "@/components/leads/lead-drawer";

/**
 * סרגל פעולות מהיר קבוע בתחתית המסך, זמין מכל עמוד באפליקציה (מוצג פעם
 * אחת ב-AppShell). מחליף את ה-FAB הישן ("+") שהיה קיים לפני שהיה סרגל פעולות.
 */
export function QuickActionBar() {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [pickLeadForQuoteOpen, setPickLeadForQuoteOpen] = useState(false);
  const [quoteLeadId, setQuoteLeadId] = useState<string | null>(null);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center gap-6 border-t border-border bg-card/95 py-2 backdrop-blur-sm sm:gap-10">
        <QuickAction icon={Plus} label="כרטיס אירוע חדש" onClick={() => setNewLeadOpen(true)} />
        <QuickAction icon={FileText} label="הצעת מחיר" onClick={() => setPickLeadForQuoteOpen(true)} />
        <QuickAction icon={CalendarPlus} label="פגישה חדשה" onClick={() => setNewMeetingOpen(true)} />
        <QuickAction icon={ListChecks} label="מטלה חדשה" onClick={() => setNewTaskOpen(true)} />
      </div>

      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
      <NewMeetingDialog open={newMeetingOpen} onOpenChange={setNewMeetingOpen} />
      <PickLeadDialog
        open={pickLeadForQuoteOpen}
        onOpenChange={setPickLeadForQuoteOpen}
        title="הצעת מחיר — בחר כרטיס אירוע"
        onPick={(leadId) => setQuoteLeadId(leadId)}
      />
      <LeadDrawer leadId={quoteLeadId} onOpenChange={(o) => !o && setQuoteLeadId(null)} initialTab="pay" />
    </>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 text-[15.75px] text-muted-foreground hover:text-foreground">
      <Icon className="size-5" />
      {label}
    </button>
  );
}
