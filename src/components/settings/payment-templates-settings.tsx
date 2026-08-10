"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import type { PaymentTemplateStep, PaymentTimingType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIMING_LABELS: Record<PaymentTimingType, string> = {
  on_signing: "בחתימת החוזה",
  before_event: "ימים לפני האירוע",
  after_event: "ימים אחרי האירוע",
};

function describeStep(step: PaymentTemplateStep): string {
  const amount = step.amount_type === "percent" ? `${step.amount_value}%` : `₪${step.amount_value}`;
  const timing =
    step.timing_type === "on_signing"
      ? TIMING_LABELS.on_signing
      : `${step.timing_days ?? 0} ${TIMING_LABELS[step.timing_type]}`;
  return `${step.label} — ${amount} · ${timing}`;
}

function newStepDraft(): PaymentTemplateStep {
  return {
    step_id: crypto.randomUUID(),
    label: "",
    amount_type: "percent",
    amount_value: 0,
    timing_type: "on_signing",
  };
}

/** עורך שלבים משותף להוספת תבנית חדשה ולעריכת תבנית קיימת. */
function StepsEditor({
  steps,
  onChange,
}: {
  steps: PaymentTemplateStep[];
  onChange: (steps: PaymentTemplateStep[]) => void;
}) {
  const updateStep = (stepId: string, updates: Partial<PaymentTemplateStep>) =>
    onChange(steps.map((s) => (s.step_id === stepId ? { ...s, ...updates } : s)));
  const removeStep = (stepId: string) => onChange(steps.filter((s) => s.step_id !== stepId));

  return (
    <div className="grid gap-1.5">
      {steps.map((step, i) => (
        <div key={step.step_id} className="grid gap-2 rounded-md border border-border p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">שלב {i + 1}</span>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => removeStep(step.step_id)}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-normal text-muted-foreground">תיאור</Label>
            <Input
              placeholder="למשל: מקדמה"
              value={step.label}
              onChange={(e) => updateStep(step.step_id, { label: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs font-normal text-muted-foreground">סכום</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  dir="ltr"
                  value={step.amount_value}
                  onChange={(e) => updateStep(step.step_id, { amount_value: Number(e.target.value) || 0 })}
                  className="h-8 text-xs"
                />
                <Select
                  value={step.amount_type}
                  onValueChange={(v) => v && updateStep(step.step_id, { amount_type: v as "percent" | "fixed" })}
                >
                  <SelectTrigger size="sm" className="w-16 text-xs">
                    <SelectValue>{(v: string) => (v === "percent" ? "%" : "₪")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="fixed">₪</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs font-normal text-muted-foreground">מועד תשלום</Label>
              <div className="flex gap-1">
                <Select
                  value={step.timing_type}
                  onValueChange={(v) => v && updateStep(step.step_id, { timing_type: v as PaymentTimingType })}
                >
                  <SelectTrigger size="sm" className="flex-1 text-xs">
                    <SelectValue>{(v: string) => TIMING_LABELS[v as PaymentTimingType]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_signing">{TIMING_LABELS.on_signing}</SelectItem>
                    <SelectItem value="before_event">{TIMING_LABELS.before_event}</SelectItem>
                    <SelectItem value="after_event">{TIMING_LABELS.after_event}</SelectItem>
                  </SelectContent>
                </Select>
                {step.timing_type !== "on_signing" && (
                  <Input
                    type="number"
                    dir="ltr"
                    placeholder="ימים"
                    value={step.timing_days ?? ""}
                    onChange={(e) => updateStep(step.step_id, { timing_days: Number(e.target.value) || 0 })}
                    className="h-8 w-14 text-xs"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="w-fit gap-1.5"
        onClick={() => onChange([...steps, newStepDraft()])}
      >
        <Plus className="size-3.5" />
        הוסף שלב
      </Button>
    </div>
  );
}

export function PaymentTemplatesSettings() {
  const templates = useLeadsStore((s) => s.paymentTemplates);
  const addPaymentTemplate = useLeadsStore((s) => s.addPaymentTemplate);
  const updatePaymentTemplate = useLeadsStore((s) => s.updatePaymentTemplate);
  const deletePaymentTemplate = useLeadsStore((s) => s.deletePaymentTemplate);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSteps, setEditSteps] = useState<PaymentTemplateStep[]>([]);

  const startEdit = (templateId: string) => {
    const t = templates.find((x) => x.template_id === templateId);
    if (!t) return;
    setEditId(templateId);
    setEditName(t.name);
    setEditSteps(t.steps.map((s) => ({ ...s })));
  };

  const saveEdit = () => {
    if (!editName.trim() || editSteps.length === 0 || editSteps.some((s) => !s.label.trim())) {
      toast.error("יש להזין שם לתבנית ולפחות שלב אחד עם תיאור");
      return;
    }
    updatePaymentTemplate(editId!, { name: editName.trim(), steps: editSteps });
    setEditId(null);
    toast.success("התבנית עודכנה");
  };

  const [newName, setNewName] = useState("");
  const [newSteps, setNewSteps] = useState<PaymentTemplateStep[]>([newStepDraft()]);

  const submitNew = () => {
    if (!newName.trim() || newSteps.length === 0 || newSteps.some((s) => !s.label.trim())) {
      toast.error("יש להזין שם לתבנית ולפחות שלב אחד עם תיאור");
      return;
    }
    addPaymentTemplate({ name: newName.trim(), steps: newSteps, active: true });
    setNewName("");
    setNewSteps([newStepDraft()]);
    toast.success("התבנית נוספה");
  };

  return (
    <BlueprintBox className="mx-auto mt-4 w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Receipt className="size-4 text-muted-foreground" />
        <h2 className="text-base">תבניות לוח תשלומים</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        תבניות זמינות לבחירה בהפקת חוזה. עריכת תבנית לא משפיעה על לוחות תשלום שכבר הופקו בחוזים קיימים.
      </p>

      <div className="mt-3 grid gap-1.5">
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground">אין עדיין תבניות לוח תשלומים.</p>
        )}
        {templates.map((t) => {
          const editing = editId === t.template_id;
          return (
            <div
              key={t.template_id}
              className={cn("grid gap-2 border border-border px-2.5 py-2 text-sm", !t.active && "opacity-50")}
            >
              {editing ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                  <StepsEditor steps={editSteps} onChange={setEditSteps} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>
                      שמור
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                      ביטול
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.steps.map(describeStep).join(" • ")}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => startEdit(t.template_id)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => {
                      deletePaymentTemplate(t.template_id);
                      toast.success("התבנית נמחקה");
                    }}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Separator className="my-4" />

      <div className="grid gap-2 border border-dashed border-border p-3">
        <Label className="text-xs text-muted-foreground">הוספת תבנית חדשה</Label>
        <Input
          placeholder="שם התבנית (למשל: מקדמה + גמר אחרי האירוע)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-9"
        />
        <StepsEditor steps={newSteps} onChange={setNewSteps} />
        <Button className="w-fit gap-1.5" onClick={submitNew}>
          <Plus className="size-3.5" />
          הוסף תבנית
        </Button>
      </div>
    </BlueprintBox>
  );
}
