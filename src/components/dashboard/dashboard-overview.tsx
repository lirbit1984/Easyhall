"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Maximize2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { AddCalendarEventDialog } from "@/components/calendar/add-calendar-event-dialog";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeadsStore } from "@/store/use-leads-store";
import { CALENDAR_EVENT_COLORS, CALENDAR_EVENT_LABELS } from "@/lib/types";
import { WEEKDAYS, MONTH_NAMES, buildMonthGrid, sameDate, toYMD } from "@/lib/calendar-grid";
import { useJewishHolidaysForYears } from "@/lib/use-jewish-holidays";
import { getEventTitle, isOverdue, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function timeGreeting(hour: number): string {
  if (hour < 5) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  if (hour < 22) return "ערב טוב";
  return "לילה טוב";
}

/**
 * דף הבית של המערכת: KPIs, לוח שנה חודשי מלא ופאנל מטלות באותו גודל. הצנרת
 * המלאה (קנבאן/טבלה) יושבת ב-/kanban; היומן הגדול עם כל התכונות ב-/calendar —
 * כאן לוח חודשי אינטראקטיבי (ניתן להוסיף אירוע ישירות מכאן, בלי לנווט).
 */
export function DashboardOverview() {
  const router = useRouter();
  const leads = useLeadsStore((s) => s.leads);
  const tasks = useLeadsStore((s) => s.tasks);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);
  const toggleTask = useLeadsStore((s) => s.toggleTask);
  const currentUserName = useLeadsStore((s) => s.currentUserName);

  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [weekMeetingsOpen, setWeekMeetingsOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear();
  const month = today.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const { labels: holidays } = useJewishHolidaysForYears(
    month === 0 ? [year - 1, year] : month === 11 ? [year, year + 1] : [year]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof calendarEvents>();
    for (const e of calendarEvents) {
      const key = new Date(e.start_time).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [calendarEvents]);

  const openLeadsCount = leads.filter((l) => l.status === "potential").length;

  const eventsThisMonthCount = leads.filter(
    (l) =>
      l.event_date &&
      new Date(l.event_date).getFullYear() === year &&
      new Date(l.event_date).getMonth() === month
  ).length;

  const weekMeetings = useMemo(() => {
    const now = today.getTime();
    return calendarEvents
      .filter((e) => {
        const t = new Date(e.start_time).getTime();
        return t >= now && t <= now + WEEK_MS;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [calendarEvents, today]);

  const overdueTasks = tasks.filter((t) => !t.is_completed && isOverdue(t.due_date));
  const hasOverdue = overdueTasks.length > 0;
  const firstName = currentUserName.trim().split(/\s+/)[0] ?? currentUserName;

  const sortedOpenTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.is_completed)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [tasks]
  );

  const kpis = [
    { id: "leads", label: "לידים פתוחים", value: openLeadsCount, onClick: () => router.push("/kanban") },
    { id: "events", label: "אירועים החודש", value: eventsThisMonthCount, onClick: () => router.push("/calendar") },
    { id: "meetings", label: "פגישות השבוע", value: weekMeetings.length, onClick: () => setWeekMeetingsOpen(true) },
    { id: "overdue", label: "מטלות באיחור", value: overdueTasks.length, danger: hasOverdue, onClick: () => setTasksExpanded(true) },
  ];

  const openDayDialog = (day: Date) => {
    setSelectedDay(day);
    setAddEventOpen(true);
  };

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title={`${timeGreeting(today.getHours())}, ${firstName}`} subtitle={today.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />

      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <button
            key={k.id}
            onClick={k.onClick}
            className="text-right transition-transform hover:-translate-y-0.5"
          >
            <BlueprintBox className={cn("transition-shadow hover:shadow-md", k.danger && "bg-destructive/5")}>
              <div className={cn("font-heading text-[28px] font-semibold leading-none", k.danger && "text-destructive")}>
                {k.value}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[.1em] text-muted-foreground">{k.label}</div>
            </BlueprintBox>
          </button>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        {/* לוח שנה חודשי */}
        <BlueprintBox>
          <BoxKicker>{MONTH_NAMES[month]} {year}</BoxKicker>
          <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((day, i) => {
              const isCurrentMonth = day.getMonth() === month;
              const isToday = sameDate(day, today);
              const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
              const primaryEvent = dayEvents[0];
              const holiday = holidays.get(toYMD(day));
              return (
                <button
                  key={i}
                  onClick={() => openDayDialog(day)}
                  title={
                    [primaryEvent && CALENDAR_EVENT_LABELS[primaryEvent.event_type], holiday]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  className={cn(
                    "flex h-7 flex-col items-center justify-center text-[11px] leading-none",
                    !isCurrentMonth && "text-muted-foreground/40",
                    isToday && "font-semibold ring-1 ring-primary",
                    holiday && !primaryEvent && "text-amber-600"
                  )}
                  style={
                    primaryEvent
                      ? { background: CALENDAR_EVENT_COLORS[primaryEvent.event_type], color: "#fff" }
                      : undefined
                  }
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </BlueprintBox>

        {/* מטלות */}
        <BlueprintBox>
          <div className="flex items-center justify-between">
            <BoxKicker className="mb-0">מטלות</BoxKicker>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewTaskOpen(true)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3" />
                מטלה חדשה
              </button>
              <button
                onClick={() => setTasksExpanded(true)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Maximize2 className="size-3" />
                הרחב
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {sortedOpenTasks.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">אין מטלות פתוחות.</p>
            )}
            {sortedOpenTasks.slice(0, 6).map((t) => (
              <TaskRow key={t.task_id} task={t} onOpenLead={setOpenLeadId} onToggle={toggleTask} />
            ))}
          </div>
        </BlueprintBox>
      </div>

      {/* פופאפ: כל המטלות */}
      <Dialog open={tasksExpanded} onOpenChange={setTasksExpanded}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>כל המטלות</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
            {sortedOpenTasks.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">אין מטלות פתוחות.</p>
            )}
            {sortedOpenTasks.map((t) => (
              <TaskRow key={t.task_id} task={t} onOpenLead={setOpenLeadId} onToggle={toggleTask} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />

      {/* פופאפ: פגישות השבוע */}
      <Dialog open={weekMeetingsOpen} onOpenChange={setWeekMeetingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>פגישות השבוע</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
            {weekMeetings.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">אין פגישות מתוכננות השבוע.</p>
            )}
            {weekMeetings.map((e) => {
              const lead = leads.find((l) => l.lead_id === e.lead_id);
              return (
                <div key={e.calendar_event_id} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                  {new Date(e.start_time).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" })}
                  {" — "}
                  {CALENDAR_EVENT_LABELS[e.event_type]}
                  {lead && (
                    <>
                      {" עם "}
                      <button
                        className="text-accent-foreground hover:underline"
                        onClick={() => {
                          setWeekMeetingsOpen(false);
                          setOpenLeadId(lead.lead_id);
                        }}
                      >
                        {getEventTitle(lead)}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <AddCalendarEventDialog day={selectedDay} open={addEventOpen} onOpenChange={setAddEventOpen} />
      <LeadDrawer leadId={openLeadId} onOpenChange={(open) => !open && setOpenLeadId(null)} />
    </div>
  );
}

function TaskRow({
  task,
  onOpenLead,
  onToggle,
}: {
  task: { task_id: string; title: string; lead_id?: string | null; due_date: string; is_completed: boolean };
  onOpenLead: (leadId: string) => void;
  onToggle: (taskId: string) => void;
}) {
  const leads = useLeadsStore((s) => s.leads);
  const lead = task.lead_id ? leads.find((l) => l.lead_id === task.lead_id) : undefined;
  const overdue = !task.is_completed && isOverdue(task.due_date);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
        overdue ? "bg-destructive/10 text-destructive" : "bg-muted/50"
      )}
    >
      <input
        type="checkbox"
        checked={task.is_completed}
        onChange={() => onToggle(task.task_id)}
        className="size-3.5 shrink-0 accent-primary"
      />
      <span className="flex-1">
        {task.title}
        {lead && (
          <>
            {" — "}
            <button
              className={cn("hover:underline", overdue ? "text-destructive" : "text-accent-foreground")}
              onClick={() => onOpenLead(lead.lead_id)}
            >
              {getEventTitle(lead)}
            </button>
          </>
        )}
        <span className={cn("mr-1.5 text-[11px]", overdue ? "text-destructive/80" : "text-muted-foreground")}>
          · {formatDateTime(task.due_date)}
        </span>
      </span>
      {overdue && <span className="shrink-0 text-[10px]">באיחור</span>}
    </div>
  );
}
