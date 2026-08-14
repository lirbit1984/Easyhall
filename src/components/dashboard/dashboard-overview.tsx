"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Maximize2, Search, Pencil, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { AddCalendarEventDialog } from "@/components/calendar/add-calendar-event-dialog";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { CALENDAR_EVENT_LABELS, type Task } from "@/lib/types";
import { WEEKDAYS, MONTH_NAMES, buildMonthGrid, sameDate, toYMD } from "@/lib/calendar-grid";
import { useJewishHolidaysForYears } from "@/lib/use-jewish-holidays";
import { getEventTitle, primaryPhone, isOverdue, formatDateTime, formatDate, calendarEventColor, calendarEventLabel, isCancelledMeeting } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  potential: "פוטנציאלי",
  closed: "סגור",
  not_relevant: "לא רלוונטי",
  reserved: "משוריין",
};

const SEARCH_RESULT_LIMIT = 5;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function timeGreeting(hour: number): string {
  if (hour < 5) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  if (hour < 22) return "ערב טוב";
  return "לילה טוב";
}

/**
 * דף הבית של המערכת: KPIs, לוח שנה חודשי מלא ופאנל מטלות באותו גודל. תצוגת
 * הלידים המלאה (קנבאן/טבלה) יושבת ב-/kanban; היומן הגדול עם כל התכונות ב-/calendar —
 * כאן לוח חודשי אינטראקטיבי (ניתן להוסיף אירוע ישירות מכאן, בלי לנווט).
 */
export function DashboardOverview() {
  const router = useRouter();
  const leads = useLeadsStore((s) => s.leads);
  const allTasks = useLeadsStore((s) => s.tasks);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);
  const activity = useLeadsStore((s) => s.activity);
  const toggleTask = useLeadsStore((s) => s.toggleTask);
  const deleteTask = useLeadsStore((s) => s.deleteTask);
  const currentUserName = useLeadsStore((s) => s.currentUserName);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const role = useCurrentRole();

  const tasks = useMemo(
    () =>
      role === "admin"
        ? allTasks
        : allTasks.filter(
            (t) => t.assigned_user_id === currentUserId || t.created_by_user_id === currentUserId
          ),
    [allTasks, role, currentUserId]
  );

  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [highlightActivityId, setHighlightActivityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAllLeadResults, setShowAllLeadResults] = useState(false);
  const [showAllActivityResults, setShowAllActivityResults] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  const [taskTab, setTaskTab] = useState<"open" | "done">("open");
  const [expandedTaskTab, setExpandedTaskTab] = useState<"open" | "done">("open");
  const [weekMeetingsOpen, setWeekMeetingsOpen] = useState(false);
  const [leadsEmptyOpen, setLeadsEmptyOpen] = useState(false);
  const [eventsThisMonthOpen, setEventsThisMonthOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addEventOpen, setAddEventOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [monthOffset, setMonthOffset] = useState(0);
  const viewedDate = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1),
    [today, monthOffset]
  );
  const year = viewedDate.getFullYear();
  const month = viewedDate.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const gridRows = grid.length / 7;
  const { labels: holidays } = useJewishHolidaysForYears(
    month === 0 ? [year - 1, year] : month === 11 ? [year, year + 1] : [year]
  );

  // פגישות שבוטלו מוסתרות מכל תצוגות היומן בדשבורד, כמו במסך היומן המלא.
  const visibleCalendarEvents = useMemo(
    () => calendarEvents.filter((e) => !isCancelledMeeting(e, leads)),
    [calendarEvents, leads]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof calendarEvents>();
    for (const e of visibleCalendarEvents) {
      const key = new Date(e.start_time).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [visibleCalendarEvents]);

  const reservedLeadIds = useMemo(
    () => new Set(calendarEvents.filter((e) => e.event_type === "option_hold").map((e) => e.lead_id)),
    [calendarEvents]
  );

  const openLeadsCount = leads.filter(
    (l) => l.status === "potential" || reservedLeadIds.has(l.lead_id)
  ).length;

  const searchQueryDigits = searchQuery.replace(/\D/g, "");
  const searchQueryNorm = searchQuery.trim().toLowerCase();

  const leadSearchResults = useMemo(() => {
    if (!searchQueryNorm) return [];
    return leads.filter((l) => {
      const nameMatch = l.contacts?.some((c) => c.name.toLowerCase().includes(searchQueryNorm)) ?? false;
      const phoneMatch =
        searchQueryDigits.length > 0 &&
        (l.contacts?.some((c) => (c.phone ?? "").replace(/\D/g, "").includes(searchQueryDigits)) ?? false);
      return nameMatch || phoneMatch;
    });
  }, [leads, searchQueryNorm, searchQueryDigits]);

  const activitySearchResults = useMemo(() => {
    if (!searchQueryNorm) return [];
    return activity
      .filter((a) => a.content.toLowerCase().includes(searchQueryNorm))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activity, searchQueryNorm]);

  const leadStatusLabel = (l: (typeof leads)[number]) =>
    STATUS_LABELS[reservedLeadIds.has(l.lead_id) ? "reserved" : l.status];

  const openSearchResultLead = (leadId: string, activityId?: string) => {
    setOpenLeadId(leadId);
    setHighlightActivityId(activityId ?? null);
    setSearchQuery("");
    setSearchFocused(false);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const eventsThisMonth = useMemo(
    () =>
      leads
        .filter(
          (l) =>
            l.status === "closed" &&
            l.event_date &&
            new Date(l.event_date).getFullYear() === today.getFullYear() &&
            new Date(l.event_date).getMonth() === today.getMonth()
        )
        .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime()),
    [leads, today]
  );
  const eventsThisMonthCount = eventsThisMonth.length;

  // ניווט חודשים בתוך חלונית "אירועים החודש" — נפרד ממה שהכרטיסייה עצמה
  // מציגה (eventsThisMonth/eventsThisMonthCount נשארים תמיד על החודש
  // הנוכחי האמיתי, בדיוק כמו eventsByDay/eventsThisMonthCount ללוח השנה הקטן).
  const [eventsMonthOffset, setEventsMonthOffset] = useState(0);
  const eventsViewedDate = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + eventsMonthOffset, 1),
    [today, eventsMonthOffset]
  );
  const eventsForViewedMonth = useMemo(
    () =>
      leads
        .filter(
          (l) =>
            l.status === "closed" &&
            l.event_date &&
            new Date(l.event_date).getFullYear() === eventsViewedDate.getFullYear() &&
            new Date(l.event_date).getMonth() === eventsViewedDate.getMonth()
        )
        .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime()),
    [leads, eventsViewedDate]
  );

  const weekMeetings = useMemo(() => {
    const now = today.getTime();
    return calendarEvents
      .filter((e) => {
        if (e.event_type !== "sales_meeting") return false;
        const t = new Date(e.start_time).getTime();
        return t >= now && t <= now + WEEK_MS;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [calendarEvents, today]);

  const [dayOffset, setDayOffset] = useState(0);
  const viewedDay = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [today, dayOffset]);

  // בשונה מלוח השנה, רשימת "מה יש לנו היום" כן מציגה פגישות שבוטלו — מסומנות
  // ככאלה — כדי שברור שהמשבצת התפנתה ולא שהפגישה נעלמה.
  const todayEvents = useMemo(
    () =>
      calendarEvents
        .filter((e) => sameDate(new Date(e.start_time), viewedDay))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [calendarEvents, viewedDay]
  );

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

  const sortedCompletedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.is_completed)
        .sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime()),
    [tasks]
  );

  const kpis = [
    {
      id: "leads",
      label: "לידים פתוחים",
      value: openLeadsCount,
      onClick: () => (openLeadsCount === 0 ? setLeadsEmptyOpen(true) : router.push("/kanban?filter=open")),
    },
    {
      id: "events",
      label: "אירועים החודש",
      value: eventsThisMonthCount,
      onClick: () => {
        setEventsMonthOffset(0);
        setEventsThisMonthOpen(true);
      },
    },
    { id: "meetings", label: "פגישות השבוע", value: weekMeetings.length, onClick: () => setWeekMeetingsOpen(true) },
    { id: "overdue", label: "מטלות באיחור", value: overdueTasks.length, danger: hasOverdue, onClick: () => setOverdueExpanded(true) },
  ];

  const openDayDialog = (day: Date) => {
    setSelectedDay(day);
    setAddEventOpen(true);
  };

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title={`${timeGreeting(today.getHours())}, ${firstName}`} subtitle={today.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />

      <div ref={searchBoxRef} className="relative mx-auto mb-4 max-w-xl">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowAllLeadResults(false);
            setShowAllActivityResults(false);
          }}
          onFocus={() => setSearchFocused(true)}
          placeholder="חפש אירוע, שם, טלפון או הודעה..."
          className="h-10 border-2 border-border pr-9 focus-visible:border-primary"
        />
        {searchFocused && searchQueryNorm && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-popover p-2 text-right shadow-lg">
            {leadSearchResults.length === 0 && activitySearchResults.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">לא נמצאו תוצאות.</p>
            )}

            {leadSearchResults.length > 0 && (
              <div className="mb-1.5">
                <p className="px-1.5 py-1 text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">
                  כרטיסי אירוע
                </p>
                {(showAllLeadResults ? leadSearchResults : leadSearchResults.slice(0, SEARCH_RESULT_LIMIT)).map(
                  (l) => (
                    <button
                      key={l.lead_id}
                      onClick={() => openSearchResultLead(l.lead_id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">
                        {leadStatusLabel(l)}
                      </span>
                      <span className="flex-1 text-right">
                        {getEventTitle(l)}
                        <span className="mr-1.5 text-xs text-muted-foreground">· {primaryPhone(l)}</span>
                      </span>
                    </button>
                  )
                )}
                {!showAllLeadResults && leadSearchResults.length > SEARCH_RESULT_LIMIT && (
                  <button
                    onClick={() => setShowAllLeadResults(true)}
                    className="w-full px-2 py-1 text-xs text-accent-foreground hover:underline"
                  >
                    הצג עוד {leadSearchResults.length - SEARCH_RESULT_LIMIT} תוצאות
                  </button>
                )}
              </div>
            )}

            {activitySearchResults.length > 0 && (
              <div>
                <p className="px-1.5 py-1 text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">
                  תקשורת
                </p>
                {(showAllActivityResults
                  ? activitySearchResults
                  : activitySearchResults.slice(0, SEARCH_RESULT_LIMIT)
                ).map((a) => {
                  const activityLead = leads.find((l) => l.lead_id === a.lead_id);
                  return (
                    <button
                      key={a.activity_id}
                      onClick={() => openSearchResultLead(a.lead_id, a.activity_id)}
                      className="block w-full rounded-md px-2 py-1.5 text-right text-sm hover:bg-muted"
                    >
                      <span className="block truncate text-muted-foreground">{a.content}</span>
                      <span className="text-xs text-muted-foreground">
                        {activityLead ? getEventTitle(activityLead) : "ליד"} · {formatDate(a.created_at)}
                      </span>
                    </button>
                  );
                })}
                {!showAllActivityResults && activitySearchResults.length > SEARCH_RESULT_LIMIT && (
                  <button
                    onClick={() => setShowAllActivityResults(true)}
                    className="w-full px-2 py-1 text-xs text-accent-foreground hover:underline"
                  >
                    הצג עוד {activitySearchResults.length - SEARCH_RESULT_LIMIT} תוצאות
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

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

      <div className="grid gap-3.5 lg:grid-cols-3">
        {/* לוח שנה חודשי */}
        <BlueprintBox>
          <div className="mb-1 flex items-center justify-between">
            <BoxKicker className="mb-0">{MONTH_NAMES[month]} {year}</BoxKicker>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setMonthOffset((o) => o + 1)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="חודש הבא"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                onClick={() => setMonthOffset(0)}
                className={cn(
                  "px-1 text-[10.5px] text-muted-foreground hover:text-foreground",
                  monthOffset === 0 && "invisible"
                )}
              >
                היום
              </button>
              <button
                onClick={() => setMonthOffset((o) => o - 1)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="חודש קודם"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((day, i) => {
              const isCurrentMonth = day.getMonth() === month;
              const isToday = sameDate(day, today);
              const isPast = day < today && !isToday;
              const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
              const primaryEvent = dayEvents[0];
              const holiday = holidays.get(toYMD(day));
              const hasPopover = dayEvents.length > 0 || !!holiday;
              const row = Math.floor(i / 7);
              const col = i % 7;
              const openUpward = row >= gridRows - 2;
              const openLeftward = col === 6;
              return (
                <div key={i} className="group relative">
                  <button
                    onClick={() => openDayDialog(day)}
                    className={cn(
                      "flex h-7 w-full flex-col items-center justify-center text-[11px] leading-none",
                      !primaryEvent && !isCurrentMonth && "text-muted-foreground/40",
                      !primaryEvent && isPast && isCurrentMonth && "text-muted-foreground/70",
                      isToday && "font-semibold ring-1 ring-primary",
                      holiday && !primaryEvent && (isPast ? "text-amber-600/60" : "text-amber-600")
                    )}
                    style={
                      primaryEvent
                        ? isPast
                          ? {
                              background: `color-mix(in srgb, ${calendarEventColor(primaryEvent, leads)} 45%, var(--background))`,
                              color: "var(--foreground)",
                            }
                          : { background: calendarEventColor(primaryEvent, leads), color: "#fff" }
                        : undefined
                    }
                  >
                    {day.getDate()}
                  </button>
                  {hasPopover && (
                    <div
                      dir="rtl"
                      className={cn(
                        "absolute z-20 hidden group-hover:block",
                        openUpward ? "bottom-full pb-1" : "top-full pt-1",
                        openLeftward ? "left-0" : "right-0"
                      )}
                    >
                      <div className="min-w-[170px] rounded-md border border-border bg-popover p-1 text-right shadow-md">
                        {holiday && (
                          <div className={cn("px-2 py-1 text-[10.5px]", isPast ? "text-amber-600/60" : "text-amber-600")}>
                            {holiday}
                          </div>
                        )}
                        {dayEvents.map((e) => {
                          const eventLead = leads.find((l) => l.lead_id === e.lead_id);
                          return (
                            <button
                              key={e.calendar_event_id}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setOpenLeadId(e.lead_id);
                              }}
                              className="block w-full rounded px-2 py-1 text-right text-[11px] hover:bg-muted"
                            >
                              <span
                                className="ml-1 inline-block size-1.5 rounded-full align-middle"
                                style={{ background: calendarEventColor(e, leads) }}
                              />
                              {calendarEventLabel(e, leads)}
                              {eventLead && ` — ${getEventTitle(eventLead)}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
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
          <div className="mt-2 flex gap-1">
            <button
              onClick={() => setTaskTab("open")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                taskTab === "open"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              פתוחות
            </button>
            <button
              onClick={() => setTaskTab("done")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                taskTab === "done"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              בוצעו
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {taskTab === "open" ? (
              <>
                {sortedOpenTasks.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">אין מטלות פתוחות.</p>
                )}
                {sortedOpenTasks.slice(0, 6).map((t) => (
                  <TaskRow key={t.task_id} task={t} onOpenLead={setOpenLeadId} onToggle={toggleTask} onEdit={setEditingTask} onDelete={setDeleteTaskTarget} />
                ))}
              </>
            ) : (
              <>
                {sortedCompletedTasks.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">אין מטלות שבוצעו.</p>
                )}
                {sortedCompletedTasks.slice(0, 6).map((t) => (
                  <TaskRow key={t.task_id} task={t} onOpenLead={setOpenLeadId} onToggle={toggleTask} onEdit={setEditingTask} onDelete={setDeleteTaskTarget} />
                ))}
              </>
            )}
          </div>
        </BlueprintBox>

        {/* מה יש לנו היום */}
        <BlueprintBox>
          <div className="flex items-center justify-between">
            <BoxKicker className="mb-0">
              {dayOffset === 0
                ? "מה יש לנו היום"
                : `מה יש לנו ב-${viewedDay.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}`}
            </BoxKicker>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setDayOffset((o) => o + 1)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="יום הבא"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                onClick={() => setDayOffset(0)}
                className={cn(
                  "px-1 text-[10.5px] text-muted-foreground hover:text-foreground",
                  dayOffset === 0 && "invisible"
                )}
              >
                היום
              </button>
              <button
                onClick={() => setDayOffset((o) => o - 1)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="יום קודם"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {todayEvents.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {dayOffset === 0 ? "אין לנו אירועים או פגישות היום." : "אין אירועים או פגישות ביום זה."}
              </p>
            )}
            {todayEvents.map((e) => {
              const eventLead = leads.find((l) => l.lead_id === e.lead_id);
              const cancelled = isCancelledMeeting(e, leads);
              return (
                <button
                  key={e.calendar_event_id}
                  onClick={() => setOpenLeadId(e.lead_id)}
                  className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-right text-[13px] hover:bg-muted"
                >
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tabular-nums text-muted-foreground",
                      cancelled && "line-through"
                    )}
                  >
                    {new Date(e.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: calendarEventColor(e, leads) }}
                  />
                  <span className={cn("flex-1", cancelled && "text-muted-foreground line-through")}>
                    {calendarEventLabel(e, leads)}
                    {eventLead && ` — ${getEventTitle(eventLead)}`}
                  </span>
                </button>
              );
            })}
          </div>
        </BlueprintBox>
      </div>

      {/* פופאפ: כל המטלות */}
      <Dialog open={tasksExpanded} onOpenChange={setTasksExpanded}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>כל המטלות</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1">
            <button
              onClick={() => setExpandedTaskTab("open")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                expandedTaskTab === "open"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              פתוחות
            </button>
            <button
              onClick={() => setExpandedTaskTab("done")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                expandedTaskTab === "done"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              בוצעו
            </button>
          </div>
          <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
            {expandedTaskTab === "open" ? (
              <>
                {sortedOpenTasks.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">אין מטלות פתוחות.</p>
                )}
                {sortedOpenTasks.map((t) => (
                  <TaskRow key={t.task_id} task={t} onOpenLead={setOpenLeadId} onToggle={toggleTask} onEdit={setEditingTask} onDelete={setDeleteTaskTarget} />
                ))}
              </>
            ) : (
              <>
                {sortedCompletedTasks.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">אין מטלות שבוצעו.</p>
                )}
                {sortedCompletedTasks.map((t) => (
                  <TaskRow key={t.task_id} task={t} onOpenLead={setOpenLeadId} onToggle={toggleTask} onEdit={setEditingTask} onDelete={setDeleteTaskTarget} />
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* פופאפ: מטלות באיחור */}
      <Dialog open={overdueExpanded} onOpenChange={setOverdueExpanded}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>מטלות באיחור</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
            {overdueTasks.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">אין מטלות באיחור.</p>
            )}
            {overdueTasks.map((t) => (
              <TaskRow key={t.task_id} task={t} onOpenLead={setOpenLeadId} onToggle={toggleTask} onEdit={setEditingTask} onDelete={setDeleteTaskTarget} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
      <NewTaskDialog
        open={!!editingTask}
        onOpenChange={(o) => !o && setEditingTask(null)}
        editTask={editingTask}
      />

      <AlertDialog open={!!deleteTaskTarget} onOpenChange={(o) => !o && setDeleteTaskTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את המטלה?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTaskTarget && `המטלה "${deleteTaskTarget.title}" תימחק. הפעולה בלתי הפיכה.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTaskTarget) deleteTask(deleteTaskTarget.task_id);
                setDeleteTaskTarget(null);
              }}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* פופאפ: אין לידים פתוחים */}
      <Dialog open={leadsEmptyOpen} onOpenChange={setLeadsEmptyOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>לידים פתוחים</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-center text-sm text-muted-foreground">אין לידים פתוחים כרגע.</p>
        </DialogContent>
      </Dialog>

      {/* פופאפ: אירועים החודש */}
      <Dialog open={eventsThisMonthOpen} onOpenChange={setEventsThisMonthOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>
              אירועים החודש — {MONTH_NAMES[eventsViewedDate.getMonth()]} {eventsViewedDate.getFullYear()}
            </DialogTitle>
          </DialogHeader>

          <div className="mb-1 pl-8">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEventsMonthOffset((o) => o + 1)}
                aria-label="חודש הבא"
                className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-3.5" />
              </button>
              <span className="font-medium">
                {MONTH_NAMES[eventsViewedDate.getMonth()]} {eventsViewedDate.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => setEventsMonthOffset((o) => o - 1)}
                aria-label="חודש קודם"
                className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-3.5" />
              </button>
            </div>
            <p className="mt-0.5 text-center text-[10.5px] uppercase tracking-[.06em] text-primary">
              {eventsForViewedMonth.length} אירועים סגורים החודש
            </p>
          </div>

          <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
            {eventsForViewedMonth.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">אין אירועים סגורים בחודש זה.</p>
            )}
            {eventsForViewedMonth.map((l) => (
              <button
                key={l.lead_id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-right text-sm hover:bg-muted"
                onClick={() => {
                  setEventsThisMonthOpen(false);
                  setOpenLeadId(l.lead_id);
                }}
              >
                <span className="text-accent-foreground">{getEventTitle(l)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(l.event_date!).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" })}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AddCalendarEventDialog day={selectedDay} open={addEventOpen} onOpenChange={setAddEventOpen} />
      <LeadDrawer
        leadId={openLeadId}
        onOpenChange={(open) => {
          if (!open) {
            setOpenLeadId(null);
            setHighlightActivityId(null);
          }
        }}
        highlightActivityId={highlightActivityId}
      />
    </div>
  );
}

function TaskRow({
  task,
  onOpenLead,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onOpenLead: (leadId: string) => void;
  onToggle: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const leads = useLeadsStore((s) => s.leads);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const { members } = useOrgMembers();
  const lead = task.lead_id ? leads.find((l) => l.lead_id === task.lead_id) : undefined;
  const overdue = !task.is_completed && isOverdue(task.due_date);
  const completedByName = task.completed_by_user_id
    ? members.find((m) => m.user_id === task.completed_by_user_id)?.full_name
    : undefined;
  const assignedByName =
    task.assigned_user_id === currentUserId && task.created_by_user_id !== currentUserId
      ? members.find((m) => m.user_id === task.created_by_user_id)?.full_name
      : undefined;

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-[13px]",
        overdue ? "bg-destructive/10 text-destructive" : "bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={task.is_completed}
          onChange={() => onToggle(task.task_id)}
          className="size-3.5 shrink-0 accent-primary"
        />
        <span className="flex-1">
          {lead ? (
            <button
              className={cn("text-right hover:underline", overdue ? "text-destructive" : "text-accent-foreground")}
              onClick={() => onOpenLead(lead.lead_id)}
            >
              {task.title}
            </button>
          ) : (
            <span>{task.title}</span>
          )}
          <span className={cn("mr-1.5 text-[11px]", overdue ? "text-destructive/80" : "text-muted-foreground")}>
            · {formatDateTime(task.due_date)}
          </span>
        </span>
        {overdue && <span className="shrink-0 text-[10px]">באיחור</span>}
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onEdit(task)}
          aria-label="עריכת מטלה"
        >
          <Pencil className="size-3" />
        </button>
        {task.is_completed && (
          <button
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(task)}
            aria-label="מחיקת מטלה"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      {task.is_completed && task.completed_at && (
        <span className="mr-5 text-[10.5px] text-muted-foreground">
          בוצע ע״י {completedByName ?? "משתמש"} · {formatDateTime(task.completed_at)}
        </span>
      )}
      {assignedByName && (
        <span className="mr-5 text-[10.5px] text-muted-foreground">שויך ע״י {assignedByName}</span>
      )}
    </div>
  );
}
