"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft, ChevronDown, Plus, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { useLeadsStore } from "@/store/use-leads-store";
import { CALENDAR_EVENT_COLORS, CALENDAR_EVENT_LABELS, MEETING_TYPE_COLORS, MEETING_TYPE_LABELS } from "@/lib/types";
import type { CalendarEvent } from "@/lib/types";
import { calendarEventColor, calendarEventLabel, isCancelledMeeting } from "@/lib/format";
import { WEEKDAYS, MONTH_NAMES, buildMonthGrid, sameDate, toYMD } from "@/lib/calendar-grid";
import { getEventTitle } from "@/lib/format";
import { useJewishHolidaysForYears } from "@/lib/use-jewish-holidays";
import { useHeterKiddushinDates } from "@/lib/heter-kiddushin";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { AddCalendarEventDialog } from "@/components/calendar/add-calendar-event-dialog";
import { CalendarTimeGrid } from "@/components/calendar/calendar-time-grid";
import { CalendarExportDialog } from "@/components/calendar/calendar-export-dialog";
import { LeadDrawer } from "@/components/leads/lead-drawer";

export function CalendarView() {
  const [cursor, setCursor] = useState(() => new Date());
  const leads = useLeadsStore((s) => s.leads);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);
  const cancelMeeting = useLeadsStore((s) => s.cancelMeeting);
  const rescheduleMeeting = useLeadsStore((s) => s.rescheduleMeeting);
  const deleteCalendarEvent = useLeadsStore((s) => s.deleteCalendarEvent);
  const updateCalendarEvent = useLeadsStore((s) => s.updateCalendarEvent);
  const calendarNoteOverrides = useLeadsStore((s) => s.calendarNoteOverrides);
  const setCalendarNoteOverride = useLeadsStore((s) => s.setCalendarNoteOverride);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; event: CalendarEvent } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [heterEditTarget, setHeterEditTarget] = useState<string | null>(null);
  const [heterEditText, setHeterEditText] = useState("");
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [slotInitialTime, setSlotInitialTime] = useState<string | undefined>(undefined);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - cursor.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  // "קדימה" (ChevronRight, מוצג ראשון ב-RTL) מתקדם בזמן; "אחורה" (ChevronLeft)
  // חוזר אחורה — יחידת הצעד תלויה בתצוגה הפעילה (חודש/שבוע/יום).
  const goForward = () => {
    if (viewMode === "month") setCursor(new Date(year, month + 1, 1));
    else if (viewMode === "week") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1));
  };
  const goBackward = () => {
    if (viewMode === "month") setCursor(new Date(year, month - 1, 1));
    else if (viewMode === "week") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1));
  };
  const relevantYears = month === 0 ? [year - 1, year] : month === 11 ? [year, year + 1] : [year];
  const { labels: holidays, hebrewDates } = useJewishHolidaysForYears(relevantYears);
  const heterKiddushinDates = useHeterKiddushinDates(relevantYears);

  const DEFAULT_HETER_TEXT = "היתר נישואין לספרדים";
  const heterNoteFor = (ymd: string): string | null => {
    const override = calendarNoteOverrides.find((o) => o.date === ymd);
    if (override) return override.text;
    return heterKiddushinDates.has(ymd) ? DEFAULT_HETER_TEXT : null;
  };

  const openHeterEdit = (ymd: string) => {
    setHeterEditText(heterNoteFor(ymd) ?? DEFAULT_HETER_TEXT);
    setHeterEditTarget(ymd);
  };

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of calendarEvents) {
      if (isCancelledMeeting(e, leads)) continue;
      const key = new Date(e.start_time).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    // בלי מיון, ה-slice(0,3) מציג אירועים שרירותיים לפי סדר הטעינה מ-Firestore
    // במקום את הראשונים בסדר הזמן.
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [calendarEvents, leads]);

  const openAddDialog = (day: Date) => {
    setSelectedDay(day);
    setSlotInitialTime(undefined);
    setAddOpen(true);
  };

  const openAddDialogAtHour = (day: Date, hour: number) => {
    setSelectedDay(day);
    setSlotInitialTime(`${String(hour).padStart(2, "0")}:00`);
    setAddOpen(true);
  };

  // תווית שנייה על כרטיס האירוע: לפגישה מוצג סוג הפגישה (טעימה/ראשונה/וכו',
  // כי זה ה"סוג" הרלוונטי שם) — לשאר סוגי האירוע מוצג סוג האירוע של הליד
  // עצמו (חתונה/בר מצווה/וכו'), שהוא המידע המשמעותי בפועל לבעל האולם.
  const eventSecondaryLabel = (e: CalendarEvent, lead: (typeof leads)[number] | undefined) => {
    if (e.event_type === "meeting" && e.meeting_id) {
      const meeting = lead?.meetings?.find((m) => m.meeting_id === e.meeting_id);
      if (meeting) return MEETING_TYPE_LABELS[meeting.type];
    }
    const eventType = lead ? eventTypes.find((t) => t.event_type_id === lead.event_type_id) : undefined;
    return eventType?.name ?? CALENDAR_EVENT_LABELS[e.event_type];
  };

  const openReschedule = (event: CalendarEvent) => {
    const start = new Date(event.start_time);
    setRescheduleDate(toYMD(start));
    setRescheduleTime(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
    setRescheduleTarget(event);
  };

  const saveReschedule = () => {
    if (!rescheduleTarget || !rescheduleDate) return;
    if (rescheduleTarget.event_type === "meeting") {
      rescheduleMeeting(rescheduleTarget.lead_id, rescheduleTarget.meeting_id!, rescheduleDate, rescheduleTime || null);
    } else {
      // "YYYY-MM-DD" ב-new Date נקרא כחצות UTC — מפרקים ידנית כדי לקבל
      // את התאריך המקומי שנבחר בפועל.
      const [y, mo, d] = rescheduleDate.split("-").map(Number);
      const [h, m] = rescheduleTime.split(":").map(Number);
      const start = new Date(y, mo - 1, d, h || 0, m || 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 0, 0);
      updateCalendarEvent(
        rescheduleTarget.calendar_event_id,
        rescheduleTarget.event_type,
        start.toISOString(),
        end.toISOString()
      );
    }
    toast.success("המועד עודכן");
    setRescheduleTarget(null);
  };

  const headerTitle =
    viewMode === "month"
      ? `${MONTH_NAMES[month]} ${year}`
      : viewMode === "week"
        ? `${weekDays[0].toLocaleDateString("he-IL", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}`
        : cursor.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-3 sm:p-6">
      <PageHeader
        title="יומן האולם"
        subtitle={
          viewMode === "month"
            ? "תצוגת חודש — לחצו על יום להוספת אירוע"
            : "לחצו על משבצת שעה להוספת אירוע באותה שעה"
        }
      />
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="icon" onClick={goForward}>
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="min-w-32 text-center text-base font-semibold sm:min-w-40 sm:text-lg">{headerTitle}</h2>
          <Button variant="outline" size="icon" onClick={goBackward}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            היום
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-md border border-input p-0.5">
            {(
              [
                ["month", "חודש"],
                ["week", "שבוע"],
                ["day", "יום"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs transition-colors",
                  viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-1.5">
              <FileDown className="size-3.5" />
              ייצוא
            </Button>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ChevronDown className="size-3.5" />
                    מקרא
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-auto">
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 shrink-0" style={{ background: CALENDAR_EVENT_COLORS.sales_meeting }} />
                    פגישת מכירה / סיור
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 shrink-0" style={{ background: CALENDAR_EVENT_COLORS.confirmed_event }} />
                    אירוע סגור
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 shrink-0" style={{ background: CALENDAR_EVENT_COLORS.option_hold }} />
                    תאריך משוריין / אופציה
                  </span>
                  {(Object.keys(MEETING_TYPE_LABELS) as (keyof typeof MEETING_TYPE_LABELS)[]).map((type) => (
                    <span key={type} className="flex items-center gap-1.5">
                      <span className="size-2.5 shrink-0" style={{ background: MEETING_TYPE_COLORS[type] }} />
                      {MEETING_TYPE_LABELS[type]}
                    </span>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {viewMode !== "month" && (
        <CalendarTimeGrid
          days={viewMode === "week" ? weekDays : [cursor]}
          eventsByDay={eventsByDay}
          leads={leads}
          eventTypes={eventTypes}
          onSlotClick={openAddDialogAtHour}
          onEventClick={(e) => setOpenLeadId(e.lead_id)}
          onEventContextMenu={(e, x, y) => setContextMenu({ x, y, event: e })}
        />
      )}

      {viewMode === "month" && (
      <div className="grid grid-cols-7 overflow-hidden border border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b border-border bg-muted/60 py-1.5 text-center text-[11px] font-normal uppercase tracking-[.06em] text-muted-foreground">
            {d}
          </div>
        ))}
        {grid.map((day, i) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = sameDate(day, new Date());
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0)) && !isToday;
          const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
          const holiday = holidays.get(toYMD(day));
          const hebrewDate = hebrewDates.get(toYMD(day));
          const heterNote = heterNoteFor(toYMD(day));
          return (
            <div
              key={i}
              onClick={() => openAddDialog(day)}
              className={cn(
                "group flex min-h-20 cursor-pointer flex-col gap-1 border-b border-l p-1 transition-colors hover:bg-muted/40 sm:min-h-[8.75rem] sm:p-1.5",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground/50",
                isPast && isCurrentMonth && "bg-muted/10"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center text-[11px]",
                    isToday && "bg-primary text-primary-foreground font-semibold",
                    !isToday && isPast && "text-muted-foreground/70"
                  )}
                >
                  {day.getDate()}
                </span>
                <Plus className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
              {hebrewDate && (
                <span className="truncate text-[9px] leading-tight text-muted-foreground/70">
                  {hebrewDate}
                </span>
              )}
              {holiday && (
                <span className="truncate text-[9.5px] leading-tight text-amber-600" title={holiday}>
                  {holiday}
                </span>
              )}
              {heterNote && (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openHeterEdit(toYMD(day));
                  }}
                  className="truncate text-right text-[9px] leading-tight text-purple-600 underline decoration-dotted hover:text-purple-700"
                  title="לחצו לעריכה או להסתרה"
                >
                  {heterNote}
                </button>
              )}
              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, 3).map((e) => {
                  const lead = leads.find((l) => l.lead_id === e.lead_id);
                  const name = lead ? getEventTitle(lead) : "אירוע";
                  const typeLabel = eventSecondaryLabel(e, lead);
                  const time = new Date(e.start_time).toLocaleTimeString("he-IL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <button
                      key={e.calendar_event_id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setOpenLeadId(e.lead_id);
                      }}
                      onContextMenu={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        setContextMenu({ x: ev.clientX, y: ev.clientY, event: e });
                      }}
                      className="flex flex-col rounded px-1 py-0.5 text-right leading-tight hover:opacity-90"
                      style={
                        isPast
                          ? {
                              background: `color-mix(in srgb, ${calendarEventColor(e, leads)} 45%, var(--background))`,
                              color: "var(--foreground)",
                            }
                          : { background: calendarEventColor(e, leads), color: "#fff" }
                      }
                      title={`${calendarEventLabel(e, leads)} · ${name}`}
                    >
                      <span className="truncate text-[10.5px]">
                        {name}
                        {typeLabel && ` - ${typeLabel}`}
                      </span>
                      <span className="truncate text-[9px] opacity-80">{time}</span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} נוספים</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      <AddCalendarEventDialog day={selectedDay} open={addOpen} onOpenChange={setAddOpen} initialTime={slotInitialTime} />
      <CalendarExportDialog open={exportOpen} onOpenChange={setExportOpen} defaultYear={year} defaultMonth={month} />
      <LeadDrawer leadId={openLeadId} onOpenChange={(open) => !open && setOpenLeadId(null)} />

      {contextMenu && (
        <div style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, width: 0, height: 0 }}>
          <DropdownMenu open onOpenChange={(open) => !open && setContextMenu(null)}>
            <DropdownMenuTrigger className="absolute" />
            <DropdownMenuContent align="start">
              {contextMenu.event.event_type === "meeting" || contextMenu.event.event_type === "sales_meeting" ? (
                (() => {
                  // פגישות שבוטלו כלל לא מוצגות ביומן, ולכן כאן תמיד מדובר
                  // בפגישה פעילה.
                  const isLinkedMeeting = contextMenu.event.event_type === "meeting";
                  return (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          openReschedule(contextMenu.event);
                          setContextMenu(null);
                        }}
                      >
                        קביעת מועד אחר
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          if (isLinkedMeeting) {
                            cancelMeeting(contextMenu.event.lead_id, contextMenu.event.meeting_id!);
                          } else {
                            deleteCalendarEvent(contextMenu.event.calendar_event_id);
                          }
                          toast.success("הפגישה בוטלה");
                          setContextMenu(null);
                        }}
                      >
                        ביטול פגישה
                      </DropdownMenuItem>
                    </>
                  );
                })()
              ) : contextMenu.event.event_type === "confirmed_event" ? (
                <DropdownMenuItem
                  onClick={() => {
                    setOpenLeadId(contextMenu.event.lead_id);
                    setContextMenu(null);
                  }}
                >
                  עריכה בכרטיס הליד
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    deleteCalendarEvent(contextMenu.event.calendar_event_id);
                    toast.success("השריון הוסר");
                    setContextMenu(null);
                  }}
                >
                  הסר שריון
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>קביעת מועד אחר</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>תאריך</Label>
              <DateField value={rescheduleDate} onChange={setRescheduleDate} />
            </div>
            <div className="grid gap-1.5">
              <Label>שעה</Label>
              <TimeField value={rescheduleTime} onChange={setRescheduleTime} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
              ביטול
            </Button>
            <Button disabled={!rescheduleDate} onClick={saveReschedule}>
              שמור מועד
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!heterEditTarget} onOpenChange={(open) => !open && setHeterEditTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>הערת &quot;היתר נישואין&quot;</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>טקסט ההערה</Label>
            <Textarea value={heterEditText} onChange={(e) => setHeterEditText(e.target.value)} rows={2} />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (heterEditTarget) setCalendarNoteOverride(heterEditTarget, null);
                setHeterEditTarget(null);
              }}
            >
              הסתר תאריך זה
            </Button>
            <Button
              onClick={() => {
                if (heterEditTarget) setCalendarNoteOverride(heterEditTarget, heterEditText);
                setHeterEditTarget(null);
              }}
            >
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
