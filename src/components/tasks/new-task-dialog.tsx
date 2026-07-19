"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeadsStore } from "@/store/use-leads-store";
import { coupleDisplayName } from "@/lib/format";

const NO_LEAD = "__none__";

interface NewTaskFormValues {
  title: string;
  due_date: string;
  lead_id: string;
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
  const { register, handleSubmit, reset, setValue, watch } = useForm<NewTaskFormValues>({
    defaultValues: { lead_id: NO_LEAD },
  });

  useEffect(() => {
    if (open) reset({ title: "", due_date: "", lead_id: NO_LEAD });
  }, [open, reset]);

  const onSubmit = (values: NewTaskFormValues) => {
    if (!values.title.trim() || !values.due_date) return;
    addTask({
      title: values.title.trim(),
      due_date: new Date(values.due_date).toISOString(),
      lead_id: values.lead_id === NO_LEAD ? null : values.lead_id,
      assigned_user_id: currentUserId,
      created_by_user_id: currentUserId,
    });
    toast.success("המטלה נוספה");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>מטלה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="task_title">כותרת המטלה</Label>
            <Input id="task_title" required {...register("title")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task_due">יעד</Label>
            <Input id="task_due" type="datetime-local" required {...register("due_date")} />
          </div>
          <div className="grid gap-1.5">
            <Label>ליד משוייך</Label>
            <Select value={watch("lead_id")} onValueChange={(v) => v && setValue("lead_id", v)}>
              <SelectTrigger>
                <SelectValue>
                  {(v: string) =>
                    v === NO_LEAD
                      ? "ללא ליד משוייך"
                      : coupleDisplayName(leads.find((l) => l.lead_id === v)!)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEAD}>ללא ליד משוייך</SelectItem>
                {leads.map((l) => (
                  <SelectItem key={l.lead_id} value={l.lead_id}>
                    {coupleDisplayName(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit">הוסף מטלה</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
