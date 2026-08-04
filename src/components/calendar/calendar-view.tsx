"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft, Plus } from "lucide-react";
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
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { useLeadsStore } from "@/store/use-leads-store";
import { CALENDAR_EVENT_COLORS, MEETING_TYPE_COLORS, MEETING_TYPE_LABELS } from "@/lib/types";
import type { CalendarEvent } from "@/lib/types";
import { calendarEventColor, calendarEventLabel, isCancelledMeeting } from "@/lib/format";
import { WEEKDAYS, MONTH_NAMES, buildMonthGrid, sameDate, toYMD } from "@/lib/calendar-grid";
import { getEventTitle } from "@/lib/format";
import { useJewishHolidaysForYears } from "@/lib/use-jewish-holidays";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { AddCalendarEventDialog } from "@/components/calendar/add-calendar-event-dialog";
import { LeadDrawer } from "@/components/leads/lead-drawer";

export function CalendarView() {
  const [cursor, setCursor] = useState(() => new Date());
  const leads = useLeadsStore((s) => s.leads);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);
  const cancelMeeting = useLeadsStore((s) => s.cancelMeeting);
  const rescheduleMeeting = useLeadsStore((s) => s.rescheduleMeeting);
  const deleteCalendarEvent = useLeadsStore((s) => s.deleteCalendarEvent);
  const updateCalendarEvent = useLeadsStore((s) => s.updateCalendarEvent);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; event: CalendarEvent } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const { labels: holidays, hebrewDates } = useJewishHolidaysForYears(
    month === 0 ? [year - 1, year] : month === 11 ? [year, year + 1] : [year]
  );

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
    setAddOpen(true);
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

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title="יומן האולם" subtitle="תצוגת חודש — לחצו על יום להוספת אירוע" />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="w-32 text-center text-base font-semibold sm:w-40 sm:text-lg">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            היום
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2.5" style={{ background: CALENDAR_EVENT_COLORS.sales_meeting }} />
            פגישת מכירה / סיור
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5" style={{ background: CALENDAR_EVENT_COLORS.confirmed_event }} />
            אירוע סגור
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5" style={{ background: CALENDAR_EVENT_COLORS.option_hold }} />
            תאריך משוריין / אופציה
          </span>
          {(Object.keys(MEETING_TYPE_LABELS) as (keyof typeof MEETING_TYPE_LABELS)[]).map((type) => (
            <span key={type} className="flex items-center gap-1">
              <span className="size-2.5" style={{ background: MEETING_TYPE_COLORS[type] }} />
              {MEETING_TYPE_LABELS[type]}
            </span>
          ))}
        </div>
      </div>

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
          return (
            <div
              key={i}
              onClick={() => openAddDialog(day)}
              className={cn(
                "group flex min-h-16 cursor-pointer flex-col gap-1 border-b border-l p-1 transition-colors hover:bg-muted/40 sm:min-h-24 sm:p-1.5",
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
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const lead = leads.find((l) => l.lead_id === e.lead_id);
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
                      className="truncate px-1 py-0.5 text-right text-[10px] hover:opacity-90"
                      style={
                        isPast
                          ? {
                              background: `color-mix(in srgb, ${calendarEventColor(e, leads)} 45%, var(--background))`,
                              color: "var(--foreground)",
                            }
                          : { background: calendarEventColor(e, leads), color: "#fff" }
                      }
                      title={`${calendarEventLabel(e, leads)} · ${lead ? getEventTitle(lead) : ""}`}
                    >
                      {lead ? getEventTitle(lead) : "אירוע"}
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

      <AddCalendarEventDialog day={selectedDay} open={addOpen} onOpenChange={setAddOpen} />
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
    </div>
  );
}
