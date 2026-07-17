"use client";

import { useMemo } from "react";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { PageHeader } from "@/components/layout/page-header";
import { useLeadsStore } from "@/store/use-leads-store";
import { CALENDAR_EVENT_LABELS } from "@/lib/types";
import { formatCurrency, formatDate, coupleDisplayName } from "@/lib/format";
import { cn } from "@/lib/utils";

// היקף מעגל הדונאט: 2πr כאשר r=15.9 ≈ 99.9, כך ש-dasharray נקרא כאחוזים.
const DONUT_CIRCUMFERENCE = 100;

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * מסך הבית: מבט-על על האירוע הקרוב ביותר — סטטוס העסקה, המשימות שנותרו
 * עד האירוע, ציר הפגישות ומספרי המפתח. הצנרת המלאה יושבת ב-/kanban.
 */
export function EventDashboard() {
  const leads = useLeadsStore((s) => s.leads);
  const tasks = useLeadsStore((s) => s.tasks);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);
  const toggleTask = useLeadsStore((s) => s.toggleTask);
  const currentUserName = useLeadsStore((s) => s.currentUserName);

  // האירוע המוצג: הקרוב ביותר שעוד לא עבר. עסקה סגורה גוברת על פתוחה —
  // זה האירוע שהאולם באמת מפיק.
  const featured = useMemo(() => {
    const now = Date.now();
    const upcoming = leads
      .filter((l) => l.event_date && new Date(l.event_date).getTime() >= now)
      .sort(
        (a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime()
      );
    return upcoming.find((l) => l.pipeline_stage === "closed_won") ?? upcoming[0] ?? null;
  }, [leads]);

  const leadTasks = useMemo(
    () =>
      featured
        ? tasks
            .filter((t) => t.lead_id === featured.lead_id)
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        : [],
    [tasks, featured]
  );

  const leadEvents = useMemo(
    () =>
      featured
        ? calendarEvents
            .filter((e) => e.lead_id === featured.lead_id)
            .sort(
              (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            )
        : [],
    [calendarEvents, featured]
  );

  if (!featured) {
    return (
      <div className="p-3 sm:p-6">
        <PageHeader title={`שלום, ${currentUserName}`} subtitle="מבט על האירוע הקרוב" />
        <BlueprintBox>
          <p className="text-sm text-muted-foreground">
            אין אירועים קרובים להצגה. ברגע שייקבע תאריך אירוע לזוג, הוא יופיע כאן.
          </p>
        </BlueprintBox>
      </div>
    );
  }

  const daysToEvent = daysUntil(new Date(featured.event_date!));
  const contractValue = featured.estimated_guests * featured.price_per_plate;

  const doneMilestones = featured.milestones.filter((m) => m.done).length;
  const dealPct = featured.milestones.length
    ? Math.round((doneMilestones / featured.milestones.length) * 100)
    : 0;

  const doneTasks = leadTasks.filter((t) => t.is_completed).length;
  const tasksPct = leadTasks.length ? Math.round((doneTasks / leadTasks.length) * 100) : 0;

  const now = Date.now();
  const pastMeetings = leadEvents.filter((e) => new Date(e.start_time).getTime() < now);
  const nextMeeting = leadEvents.find((e) => new Date(e.start_time).getTime() >= now);

  const stats = [
    {
      big: `${featured.estimated_guests}`,
      label: "מוזמנים",
      meta: `מחיר מנה: ${formatCurrency(featured.price_per_plate)}`,
    },
    {
      big: `${daysToEvent}`,
      label: "ימים לאירוע",
      meta: formatDate(featured.event_date),
    },
    {
      big: `${pastMeetings.length}`,
      label: "פגישות בוצעו",
      meta: nextMeeting ? `הבאה: ${formatDate(nextMeeting.start_time)}` : "אין פגישה קרובה",
    },
    {
      big: formatCurrency(contractValue),
      label: "שווי חוזה",
      meta: `${featured.estimated_guests} × ${formatCurrency(featured.price_per_plate)}`,
    },
  ];

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title={`שלום, ${currentUserName}`} subtitle="האירוע הקרוב — מבט מהיר" />

      <div className="grid gap-3.5 lg:grid-cols-[1.15fr_1fr_1.15fr]">
        {/* תמונת האירוע המוצג */}
        <BlueprintBox
          className="flex min-h-[300px] flex-col justify-end p-0 lg:row-span-2"
          style={{
            background:
              "repeating-linear-gradient(45deg, var(--color-accent-100) 0 2px, var(--card) 2px 14px)",
          }}
        >
          <div className="bg-card/80 px-[18px] py-3.5 backdrop-blur-sm">
            <div className="font-heading text-2xl font-semibold">
              {coupleDisplayName(featured)}
            </div>
            <div className="mt-0.5 text-[11px] tracking-[.1em] text-accent-foreground">
              {formatDate(featured.event_date)} · {featured.estimated_guests} מוזמנים
            </div>
          </div>
        </BlueprintBox>

        {/* דונאט סטטוס עסקה */}
        <BlueprintBox className="flex flex-col items-center text-center">
          <BoxKicker>סטטוס עסקה</BoxKicker>
          <svg
            width="150"
            height="150"
            viewBox="0 0 42 42"
            role="img"
            aria-label={`${dealPct}% מהתהליך הושלם`}
          >
            <circle
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke="var(--color-neutral-300)"
              strokeWidth="4"
            />
            <circle
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="4"
              strokeDasharray={`${dealPct} ${DONUT_CIRCUMFERENCE - dealPct}`}
              strokeDashoffset="25"
              strokeLinecap="butt"
            />
            <text
              x="21"
              y="20"
              textAnchor="middle"
              fill="currentColor"
              style={{ fontSize: "8px", fontWeight: 700 }}
            >
              {dealPct}%
            </text>
            <text
              x="21"
              y="27"
              textAnchor="middle"
              fill="currentColor"
              opacity=".6"
              style={{ fontSize: "3.2px" }}
            >
              מהתהליך הושלם
            </text>
          </svg>
          <div className="mt-1.5 flex gap-3.5 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <i className="inline-block size-2 bg-primary" />
              הושלם
            </span>
            <span className="flex items-center gap-1">
              <i
                className="inline-block size-2"
                style={{ background: "var(--color-neutral-300)" }}
              />
              נותר
            </span>
          </div>
        </BlueprintBox>

        {/* משימות עד האירוע */}
        <BlueprintBox className="lg:col-start-3 lg:row-span-2">
          <div className="flex items-start justify-between">
            <BoxKicker>משימות עד האירוע</BoxKicker>
            <span className="font-heading text-[26px] font-semibold leading-none">
              {tasksPct}%
            </span>
          </div>
          <div className="relative my-2.5 h-[5px] bg-muted">
            <div
              className="absolute inset-y-0 right-0 bg-primary"
              style={{ width: `${tasksPct}%` }}
            />
          </div>
          {leadTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">אין משימות משויכות לאירוע זה.</p>
          ) : (
            leadTasks.map((t) => (
              <button
                key={t.task_id}
                onClick={() => toggleTask(t.task_id)}
                className="flex w-full items-center gap-2.5 border-t border-border py-2 text-right"
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center border-[1.5px] border-primary text-[11px] text-primary-foreground",
                    t.is_completed && "bg-primary"
                  )}
                >
                  {t.is_completed && "✓"}
                </span>
                <span className="flex-1 text-[13px]">
                  {t.title}
                  <small className="block text-[10.5px] tracking-[.06em] text-muted-foreground">
                    {t.is_completed ? "בוצע" : `עד ${formatDate(t.due_date)}`}
                  </small>
                </span>
              </button>
            ))
          )}
        </BlueprintBox>

        {/* ציר פגישות */}
        <BlueprintBox className="lg:col-span-2 lg:col-start-1 lg:row-start-3">
          <BoxKicker>ציר פגישות</BoxKicker>
          {leadEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">טרם נקבעו פגישות לאירוע זה.</p>
          ) : (
            <div className="flex flex-col items-start gap-0.5">
              {leadEvents.map((e, i) => (
                <span
                  key={e.calendar_event_id}
                  className="my-1 inline-flex items-center gap-2 bg-accent px-3.5 py-1.5 text-[11.5px] text-accent-foreground"
                  style={{ marginInlineStart: `${Math.min(i * 22, 66)}%` }}
                >
                  {CALENDAR_EVENT_LABELS[e.event_type]} ·{" "}
                  {new Date(e.start_time).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "numeric",
                  })}{" "}
                  ·{" "}
                  {new Date(e.start_time).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ))}
            </div>
          )}
        </BlueprintBox>

        {/* סטטיסטיקות */}
        <div className="grid grid-cols-2 gap-3.5 lg:col-span-3 lg:grid-cols-4">
          {stats.map((s) => (
            <BlueprintBox key={s.label}>
              <div className="font-heading text-[30px] font-semibold leading-tight">{s.big}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[.1em] text-muted-foreground">
                {s.label}
              </div>
              <div className="mt-2 text-[11px] text-accent-foreground">{s.meta}</div>
            </BlueprintBox>
          ))}
        </div>
      </div>
    </div>
  );
}
