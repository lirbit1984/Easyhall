"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Check, X, Clock3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLeadsStore } from "@/store/use-leads-store";
import type { Task } from "@/lib/types";
import { formatDateTime, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function LeadTaskItem({ task }: { task: Task }) {
  const toggleTask = useLeadsStore((s) => s.toggleTask);
  const updateTask = useLeadsStore((s) => s.updateTask);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(toDatetimeLocalValue(task.due_date));

  const overdue = !task.is_completed && isOverdue(task.due_date);

  const startEdit = () => {
    setTitle(task.title);
    setDue(toDatetimeLocalValue(task.due_date));
    setEditing(true);
  };

  const save = () => {
    if (!title.trim() || !due) return;
    updateTask(task.task_id, { title: title.trim(), due_date: new Date(due).toISOString() });
    setEditing(false);
    toast.success("המטלה עודכנה");
  };

  const extend = (hours: number) => {
    const d = new Date(task.due_date);
    d.setHours(d.getHours() + hours);
    updateTask(task.task_id, { due_date: d.toISOString() });
    toast.success(hours >= 24 ? "המטלה נדחתה ביום" : `המטלה נדחתה ב-${hours} שעות`);
  };

  if (editing) {
    return (
      <li className="grid gap-1.5 rounded-md border border-dashed p-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-8 flex-1 text-sm"
          />
          <Button size="icon" className="size-8" onClick={save} title="שמור">
            <Check className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            onClick={() => setEditing(false)}
            title="ביטול"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-muted/60">
      <Checkbox
        checked={task.is_completed}
        onCheckedChange={() => toggleTask(task.task_id)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", task.is_completed && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <p
          className={cn(
            "text-[11px] text-muted-foreground",
            overdue && "font-medium text-destructive"
          )}
        >
          יעד: {formatDateTime(task.due_date)}
          {overdue && " (באיחור)"}
        </p>
      </div>
      {!task.is_completed && (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            title="דחה ביום"
            onClick={() => extend(24)}
          >
            <Clock3 className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" title="ערוך" onClick={startEdit}>
            <Pencil className="size-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}
