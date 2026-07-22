"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { getEventTitle } from "@/lib/format";
import { cn } from "@/lib/utils";

const NO_LEAD = "__none__";
const NO_ASSIGNEE = "__none__";

interface NewTaskFormValues {
  title: string;
  lead_id: string;
  assigned_user_id: string;
}

export function NewTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addTask = useLeadsStore((s) => s.addTask);
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

  useEffect(() => {
    if (open) {
      reset({ title: "", lead_id: NO_LEAD, assigned_user_id: currentUserId });
      setDueValue("");
      setDueConfirmed(false);
      setPresetInput("");
      setAddingPreset(false);
    }
  }, [open, currentUserId, reset]);

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
    addTask({
      title: values.title.trim(),
      due_date: new Date(dueValue).toISOString(),
      lead_id: values.lead_id === NO_LEAD ? null : values.lead_id,
      assigned_user_id: values.assigned_user_id === NO_ASSIGNEE ? null : values.assigned_user_id,
      created_by_user_id: currentUserId,
    });
    toast.success("המטלה נוספה");
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
          <DialogTitle>מטלה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
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

          <div className="grid gap-1.5">
            <Label>לשייך לכרטיס אירוע</Label>
            <SearchableSelect
              options={leadOptions}
              value={watch("lead_id")}
              onChange={(v) => setValue("lead_id", v)}
              searchPlaceholder="חפש כרטיס אירוע..."
            />
          </div>

          <div className="grid gap-1.5">
            <Label>אחראי</Label>
            <SearchableSelect
              options={assigneeOptions}
              value={watch("assigned_user_id")}
              onChange={(v) => setValue("assigned_user_id", v)}
              searchPlaceholder="חפש איש צוות..."
            />
          </div>

          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={!dueValue || !dueConfirmed}>
              הוסף מטלה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
