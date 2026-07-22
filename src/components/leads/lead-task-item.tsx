"use client";

import { Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useLeadsStore } from "@/store/use-leads-store";
import type { Task } from "@/lib/types";
import { formatDateTime, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LeadTaskItem({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const toggleTask = useLeadsStore((s) => s.toggleTask);

  const overdue = !task.is_completed && isOverdue(task.due_date);

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
          {task.is_completed
            ? `הושלם ${formatDateTime(task.completed_at)}`
            : `יעד: ${formatDateTime(task.due_date)}${overdue ? " (באיחור)" : ""}`}
        </p>
      </div>
      <Button size="icon" variant="ghost" className="size-7 shrink-0" title="ערוך" onClick={() => onEdit(task)}>
        <Pencil className="size-3.5" />
      </Button>
    </li>
  );
}
