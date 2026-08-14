"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Wallet, AlertTriangle, Clock } from "lucide-react";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { formatCurrency, formatDate, isOverdue, getEventTitle } from "@/lib/format";
import type { LeadEvent, LeadPaymentStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LeadPaymentSummary {
  lead: LeadEvent;
  steps: LeadPaymentStep[];
  total: number;
  paid: number;
  nextDue: LeadPaymentStep | null;
  overdue: boolean;
}

function summarize(lead: LeadEvent): LeadPaymentSummary | null {
  const steps = lead.payment_schedule;
  if (!steps || steps.length === 0) return null;
  const total = steps.reduce((sum, s) => sum + s.amount, 0);
  const paid = steps.filter((s) => s.is_paid).reduce((sum, s) => sum + s.amount, 0);
  const unpaid = steps.filter((s) => !s.is_paid).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const nextDue = unpaid[0] ?? null;
  return { lead, steps, total, paid, nextDue, overdue: !!nextDue && isOverdue(nextDue.due_date) };
}

export function PaymentTracking() {
  const leads = useLeadsStore((s) => s.leads);
  const markPaymentStepPaid = useLeadsStore((s) => s.markPaymentStepPaid);
  const role = useCurrentRole();
  const canMarkPaid = role === "admin" || role === "accounting";
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summaries = useMemo(() => {
    return leads
      .map(summarize)
      .filter((s): s is LeadPaymentSummary => s !== null)
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (!a.nextDue && !b.nextDue) return 0;
        if (!a.nextDue) return 1;
        if (!b.nextDue) return -1;
        return a.nextDue.due_date.localeCompare(b.nextDue.due_date);
      });
  }, [leads]);

  const kpis = useMemo(() => {
    const open = summaries.reduce((sum, s) => sum + (s.total - s.paid), 0);
    const overdue = summaries.filter((s) => s.overdue).reduce((sum, s) => sum + (s.nextDue?.amount ?? 0), 0);
    const paidThisMonth = summaries.reduce((sum, s) => {
      const thisMonth = new Date().toISOString().slice(0, 7);
      return (
        sum +
        s.steps
          .filter((step) => step.is_paid && step.paid_at?.slice(0, 7) === thisMonth)
          .reduce((a, step) => a + step.amount, 0)
      );
    }, 0);
    return { open, overdue, paidThisMonth };
  }, [summaries]);

  if (summaries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        <div>
          <Wallet className="mx-auto mb-2 size-8" />
          עדיין אין אירועים עם לוח תשלומים — לוח תשלומים נוצר בהפקת חוזה מכרטיס האירוע.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5 p-3 sm:p-4">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <BlueprintBox>
          <BoxKicker>סה&quot;כ חוב פתוח</BoxKicker>
          <div className="mt-2 font-heading text-[28px] font-semibold">{formatCurrency(kpis.open)}</div>
        </BlueprintBox>
        <BlueprintBox>
          <BoxKicker>באיחור</BoxKicker>
          <div className="mt-2 font-heading text-[28px] font-semibold text-destructive">
            {formatCurrency(kpis.overdue)}
          </div>
        </BlueprintBox>
        <BlueprintBox>
          <BoxKicker>נגבה החודש</BoxKicker>
          <div className="mt-2 font-heading text-[28px] font-semibold text-emerald-600">
            {formatCurrency(kpis.paidThisMonth)}
          </div>
        </BlueprintBox>
      </div>

      <div className="grid gap-2">
        {summaries.map((s) => {
          const expanded = expandedId === s.lead.lead_id;
          return (
            <BlueprintBox key={s.lead.lead_id} className="p-0">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : s.lead.lead_id)}
                className="flex w-full items-center justify-between gap-3 p-[18px] pb-3 text-right"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {getEventTitle(s.lead)} — {formatCurrency(s.total)}
                  </p>
                  <div className="mt-2 flex gap-1">
                    {s.steps.map((step) => (
                      <div
                        key={step.step_id}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          step.is_paid
                            ? "bg-emerald-500"
                            : isOverdue(step.due_date)
                              ? "bg-destructive"
                              : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.overdue && s.nextDue ? (
                    <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[16.5px] font-medium text-destructive">
                      <AlertTriangle className="size-3" />
                      {s.nextDue.label} באיחור
                    </span>
                  ) : s.nextDue ? (
                    <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[16.5px] font-medium text-accent-foreground">
                      <Clock className="size-3" />
                      {s.nextDue.label} · {formatDate(s.nextDue.due_date)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[16.5px] font-medium text-emerald-700">
                      שולם במלואו
                    </span>
                  )}
                  {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
              </button>

              {expanded && (
                <div className="grid gap-1.5 border-t border-border p-[18px] pt-3">
                  {s.steps.map((step) => (
                    <div
                      key={step.step_id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm",
                        !step.is_paid && isOverdue(step.due_date) ? "bg-destructive/10" : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={step.is_paid}
                          disabled={!canMarkPaid}
                          onChange={(e) => markPaymentStepPaid(s.lead.lead_id, step.step_id, e.target.checked)}
                          className="size-4"
                        />
                        <div>
                          <p>{step.label}</p>
                          <p className="text-[16.5px] text-muted-foreground">
                            {step.is_paid
                              ? `שולם ${step.paid_at ? formatDate(step.paid_at) : ""}`
                              : `יעד ${formatDate(step.due_date)}${isOverdue(step.due_date) ? " · באיחור" : ""}`}
                          </p>
                        </div>
                      </div>
                      <span className="font-medium">{formatCurrency(step.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </BlueprintBox>
          );
        })}
      </div>
    </div>
  );
}
