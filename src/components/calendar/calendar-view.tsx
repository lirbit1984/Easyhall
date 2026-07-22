"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeadsStore } from "@/store/use-leads-store";
import { CALENDAR_EVENT_COLORS, CALENDAR_EVENT_LABELS } from "@/lib/types";
import type { CalendarEvent } from "@/lib/types";
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

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const { labels: holidays, hebrewDates } = useJewishHolidaysForYears(
    month === 0 ? [year - 1, year] : month === 11 ? [year, year + 1] : [year]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of calendarEvents) {
      const key = new Date(e.start_time).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [calendarEvents]);

  const openAddDialog = (day: Date) => {
    setSelectedDay(day);
    setAddOpen(true);
  };

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title="יומן האולם" subtitle="תצוגת חודש — לחצו על יום להוספת אירוע" />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="w-32 text-center text-base font-semibold sm:w-40 sm:text-lg">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
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
          const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
          const holiday = holidays.get(toYMD(day));
          const hebrewDate = hebrewDates.get(toYMD(day));
          return (
            <div
              key={i}
              onClick={() => openAddDialog(day)}
              className={cn(
                "group flex min-h-16 cursor-pointer flex-col gap-1 border-b border-l p-1 transition-colors hover:bg-muted/40 sm:min-h-24 sm:p-1.5",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground/50"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center text-[11px]",
                    isToday && "bg-primary text-primary-foreground font-semibold"
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
                      className="truncate px-1 py-0.5 text-right text-[10px] text-white hover:opacity-90"
                      style={{ background: CALENDAR_EVENT_COLORS[e.event_type] }}
                      title={`${CALENDAR_EVENT_LABELS[e.event_type]} · ${lead ? getEventTitle(lead) : ""}`}
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
    </div>
  );
}
