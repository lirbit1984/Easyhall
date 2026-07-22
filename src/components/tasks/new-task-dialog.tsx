"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { getEventTitle } from "@/lib/format";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_LEAD = "__none__";
const NO_ASSIGNEE = "__none__";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface NewTaskFormValues {
  title: string;
  lead_id: string;
  assigned_user_id: string;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  editTask,
  lockedLeadId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTask?: Task | null;
  /** כשסופק — הדיאלוג נפתח מתוך כרטיס אירוע ספציפי: משדה השיוך מוסתר והמטלה משויכת אליו אוטומטית. */
  lockedLeadId?: string;
}) {
  const addTask = useLeadsStore((s) => s.addTask);
  const updateTask = useLeadsStore((s) => s.updateTask);
  const deleteTask = useLeadsStore((s) => s.deleteTask);
  const leads = useLeadsStore((s) => s.leads);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const taskPresets = useLeadsStore((s) => s.taskPresets);
  const addTaskPreset = useLeadsStore((s) => s.addTaskPreset);
  const { members } = useOrgMembers();

  const { register, handleSubmit, reset, setValue, watch } = useForm<NewTaskFormValues>({
    defaultValues: { lead_id: NO_LEAD, assigned_user_id: currentUserId },
  });

  const [dueValue, setDueValue] = useState("");
  const [dueConfirmed, setDueConfirmed] = useState(false);
  const [presetInput, setPresetInput] = useState("");
  const [addingPreset, setAddingPreset] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (editTask) {
        reset({
          title: editTask.title,
          lead_id: editTask.lead_id ?? NO_LEAD,
          assigned_user_id: editTask.assigned_user_id ?? NO_ASSIGNEE,
        });
        setDueValue(toDatetimeLocalValue(editTask.due_date));
        setDueConfirmed(true);
      } else {
        reset({ title: "", lead_id: lockedLeadId ?? NO_LEAD, assigned_user_id: currentUserId });
        setDueValue("");
        setDueConfirmed(false);
      }
      setPresetInput("");
      setAddingPreset(false);
    }
  }, [open, editTask, currentUserId, reset, lockedLeadId]);

  const leadOptions = [
    { value: NO_LEAD, label: "ללא שיוך לכרטיס אירוע" },
    ...leads.map((l) => ({ value: l.lead_id, label: getEventTitle(l) })),
  ];
  const assigneeOptions = [
    { value: NO_ASSIGNEE, label: "ללא שיוך" },
    ...members.map((m) => ({ value: m.user_id, label: m.full_name })),
  ];

  const onSubmit = (values: NewTaskFormValues) => {
    if (!values.title.trim() || !dueValue || !dueConfirmed) return;
    if (editTask) {
      updateTask(editTask.task_id, {
        title: values.title.trim(),
        due_date: new Date(dueValue).toISOString(),
      });
      toast.success("המטלה עודכנה");
    } else {
      addTask({
        title: values.title.trim(),
        due_date: new Date(dueValue).toISOString(),
        lead_id: values.lead_id === NO_LEAD ? null : values.lead_id,
        assigned_user_id: values.assigned_user_id === NO_ASSIGNEE ? null : values.assigned_user_id,
        created_by_user_id: currentUserId,
      });
      toast.success("המטלה נוספה");
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!editTask) return;
    deleteTask(editTask.task_id);
    setConfirmDeleteOpen(false);
    toast.success("המטלה נמחקה");
    onOpenChange(false);
  };

  const handleSavePreset = () => {
    if (!presetInput.trim()) return;
    addTaskPreset(presetInput.trim());
    setPresetInput("");
    setAddingPreset(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editTask ? "עריכת מטלה" : "מטלה חדשה"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
          {!editTask && (
          <div className="grid gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              {taskPresets.map((p) => (
                <button
                  key={p.preset_id}
                  type="button"
                  onClick={() => setValue("title", p.title)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {p.title}
                </button>
              ))}
              {addingPreset ? (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={presetInput}
                    onChange={(e) => setPresetInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSavePreset())}
                    placeholder="פריסט חדש..."
                    className="h-7 w-32 text-xs"
                  />
                  <Button type="button" size="sm" className="h-7" onClick={handleSavePreset}>
                    שמור
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingPreset(true)}
                  className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3" />
                  הוסף פריסט
                </button>
              )}
            </div>
          </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="task_title">כותרת המטלה</Label>
            <Input id="task_title" required {...register("title")} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="task_due">יעד</Label>
            <div className="flex gap-1.5">
              <Input
                id="task_due"
                type="datetime-local"
                required
                value={dueValue}
                onChange={(e) => {
                  setDueValue(e.target.value);
                  setDueConfirmed(false);
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant={dueConfirmed ? "default" : "outline"}
                disabled={!dueValue}
                onClick={() => setDueConfirmed(true)}
                className={cn("shrink-0 gap-1", dueConfirmed && "bg-emerald-600 hover:bg-emerald-600")}
              >
                <Check className="size-4" />
                {dueConfirmed ? "אושר" : "אישור"}
              </Button>
            </div>
          </div>

          {!editTask && !lockedLeadId && (
          <div className="grid gap-1.5">
            <Label>לשייך לכרטיס אירוע</Label>
            <SearchableSelect
              options={leadOptions}
              value={watch("lead_id")}
              onChange={(v) => setValue("lead_id", v)}
              searchPlaceholder="חפש כרטיס אירוע..."
            />
          </div>
          )}

          {!editTask && (
          <div className="grid gap-1.5">
            <Label>אחראי</Label>
            <SearchableSelect
              options={assigneeOptions}
              value={watch("assigned_user_id")}
              onChange={(v) => setValue("assigned_user_id", v)}
              searchPlaceholder="חפש איש צוות..."
            />
          </div>
          )}

          <DialogFooter className="mt-1">
            {editTask && (
              <Button
                type="button"
                variant="ghost"
                className="ml-auto gap-1.5 text-destructive hover:text-destructive sm:ml-0 sm:mr-auto"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" />
                מחק מטלה
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={!dueValue || !dueConfirmed}>
              {editTask ? "שמור שינויים" : "הוסף מטלה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את המטלה?</AlertDialogTitle>
            <AlertDialogDescription>הפעולה בלתי הפיכה.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
