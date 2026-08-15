"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Check, Plus, Trash2, Settings2, Pencil } from "lucide-react";
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
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { getEventTitle } from "@/lib/format";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_LEAD = "__none__";
const NO_ASSIGNEE = "__none__";

function toDateValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const updateTaskPreset = useLeadsStore((s) => s.updateTaskPreset);
  const deleteTaskPreset = useLeadsStore((s) => s.deleteTaskPreset);
  const { members } = useOrgMembers();

  const { register, handleSubmit, reset, setValue, watch } = useForm<NewTaskFormValues>({
    defaultValues: { lead_id: NO_LEAD, assigned_user_id: currentUserId },
  });

  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [dueConfirmed, setDueConfirmed] = useState(false);
  const dueValue = dueDate && dueTime ? `${dueDate}T${dueTime}` : "";
  const [presetInput, setPresetInput] = useState("");
  const [addingPreset, setAddingPreset] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [managePresetsOpen, setManagePresetsOpen] = useState(false);
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletePresetTarget, setDeletePresetTarget] = useState<{ preset_id: string; title: string } | null>(null);

  useEffect(() => {
    if (open) {
      setSubmitting(false);
      if (editTask) {
        reset({
          title: editTask.title,
          lead_id: editTask.lead_id ?? NO_LEAD,
          assigned_user_id: editTask.assigned_user_id ?? NO_ASSIGNEE,
        });
        setDueDate(toDateValue(editTask.due_date));
        setDueTime(toTimeValue(editTask.due_date));
        setDueConfirmed(true);
      } else {
        reset({ title: "", lead_id: lockedLeadId ?? NO_LEAD, assigned_user_id: currentUserId });
        setDueDate("");
        setDueTime("00:00");
        setDueConfirmed(false);
      }
      setPresetInput("");
      setAddingPreset(false);
    } else {
      // סגירת הדיאלוג הראשי לא אמורה להשאיר את חלון "ניהול פריסטים" (או
      // את מצב העריכה/מחיקה בתוכו) פתוח מאחור — הם מצב מקומי נפרד שלא
      // מתאפס לבד רק כי ה-Dialog החיצוני נסגר.
      setManagePresetsOpen(false);
      setRenamingPresetId(null);
      setDeletePresetTarget(null);
    }
  }, [open, editTask, currentUserId, reset, lockedLeadId]);

  const leadOptions = [
    { value: NO_LEAD, label: "ללא שיוך לכרטיס אירוע" },
    ...leads.map((l) => ({ value: l.lead_id, label: getEventTitle(l) })),
  ];

  /** ממזג פריסט עם placeholder ("...") ושם כרטיס אירוע לטקסט אחיד, למשל
   * "תשלום אקום ל..." + ליד "לירן ומעיין" -> "תשלום אקום ללירן ומעיין". */
  const mergeLeadIntoTitle = (title: string, leadId: string) => {
    if (leadId === NO_LEAD) return title;
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return title;
    // הפריסטים נכתבים ע"י המשתמש, ולכן ה-placeholder מגיע גם כשלוש נקודות
    // וגם כתו האליפסיס הבודד (…) שמקלדות/אוטו-קורקט מייצרים. בלי הצורה השנייה
    // המיזוג פשוט לא קרה והכותרת נשארה "לחזור ל...".
    if (!/\.\.\.|…/.test(title)) return title;
    return title.replace(/\.\.\.|…/, getEventTitle(lead));
  };
  const assigneeOptions = [
    { value: NO_ASSIGNEE, label: "ללא שיוך" },
    ...members.map((m) => ({ value: m.user_id, label: m.full_name })),
  ];

  const onSubmit = (values: NewTaskFormValues) => {
    if (submitting || !values.title.trim() || !dueValue || !dueConfirmed) return;
    setSubmitting(true);
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

  const startRenamePreset = (p: { preset_id: string; title: string }) => {
    setRenamingPresetId(p.preset_id);
    setRenameValue(p.title);
  };

  const saveRenamePreset = () => {
    if (!renamingPresetId || !renameValue.trim()) return;
    updateTaskPreset(renamingPresetId, renameValue.trim());
    setRenamingPresetId(null);
  };

  const confirmDeletePreset = () => {
    if (!deletePresetTarget) return;
    deleteTaskPreset(deletePresetTarget.preset_id);
    setDeletePresetTarget(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editTask ? "עריכת מטלה" : "מטלה חדשה"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
          {!editTask && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {!addingPreset && (
              <button type="button" onClick={() => setAddingPreset(true)} className="flex items-center gap-1 hover:text-foreground">
                <Plus className="size-3" />
                הוסף פריסט
              </button>
            )}
            {taskPresets.length > 0 && (
              <button type="button" onClick={() => setManagePresetsOpen(true)} className="flex items-center gap-1 hover:text-foreground">
                <Settings2 className="size-3" />
                ניהול פריסטים
              </button>
            )}
          </div>
          )}
          {!editTask && (taskPresets.length > 0 || addingPreset) && (
          <div className="-mt-1.5 flex flex-wrap items-center gap-1.5">
            {taskPresets.map((p) => (
              <button
                key={p.preset_id}
                type="button"
                onClick={() => setValue("title", mergeLeadIntoTitle(p.title, watch("lead_id")))}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {/* הצ'יפ מציג כבר את הכותרת הסופית ("לחזור לאיתי ושירן")
                    ולא את התבנית הגולמית, כדי שרואים מה ייכתב לפני הלחיצה. */}
                {mergeLeadIntoTitle(p.title, watch("lead_id"))}
              </button>
            ))}
            {addingPreset && (
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
            )}
          </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="task_title">כותרת המטלה</Label>
            <Input id="task_title" required {...register("title")} />
          </div>

          {!editTask && (
          <div className={cn("grid gap-2", !lockedLeadId && "sm:grid-cols-2")}>
            {!lockedLeadId && (
            <div className="grid gap-1.5">
              <Label>לשייך לכרטיס אירוע</Label>
              <SearchableSelect
                options={leadOptions}
                value={watch("lead_id")}
                onChange={(v) => {
                  setValue("lead_id", v);
                  setValue("title", mergeLeadIntoTitle(watch("title"), v));
                }}
                searchPlaceholder="חפש כרטיס אירוע..."
              />
            </div>
            )}

            <div className="grid gap-1.5">
              <Label>אחראי</Label>
              <SearchableSelect
                options={assigneeOptions}
                value={watch("assigned_user_id")}
                onChange={(v) => setValue("assigned_user_id", v)}
                searchPlaceholder="חפש איש צוות..."
              />
            </div>
          </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="task_due">יעד</Label>
            <div className="grid gap-1.5">
              <DateField
                id="task_due"
                value={dueDate}
                onChange={(v) => {
                  setDueDate(v);
                  setDueConfirmed(false);
                }}
              />
              <div className="flex gap-1.5">
                <TimeField
                  value={dueTime}
                  onChange={(v) => {
                    setDueTime(v);
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
          </div>

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
            <Button type="submit" disabled={submitting || !dueValue || !dueConfirmed}>
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

      {/* ניהול פריסטים — שינוי שם/מחיקה של פריסטים קיימים */}
      <Dialog open={managePresetsOpen} onOpenChange={setManagePresetsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ניהול פריסטים</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
            {taskPresets.map((p) => (
              <div key={p.preset_id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                {renamingPresetId === p.preset_id ? (
                  <>
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveRenamePreset())}
                      className="h-7 flex-1"
                    />
                    <Button type="button" size="icon-sm" variant="ghost" onClick={saveRenamePreset}>
                      <Check className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{p.title}</span>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => startRenamePreset(p)} aria-label="שנה שם">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => setDeletePresetTarget(p)} aria-label="מחק פריסט">
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePresetTarget} onOpenChange={(o) => !o && setDeletePresetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את הפריסט?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletePresetTarget && `הפריסט "${deletePresetTarget.title}" יימחק. הפעולה בלתי הפיכה.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeletePreset}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
