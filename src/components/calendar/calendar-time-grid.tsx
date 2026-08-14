"use client";

import type { CalendarEvent, EventType, LeadEvent } from "@/lib/types";
import { calendarEventColor, calendarEventLabel, getEventTitle, isCancelledMeeting } from "@/lib/format";
import { MEETING_TYPE_LABELS } from "@/lib/types";
import { sameDate } from "@/lib/calendar-grid";
import { cn } from "@/lib/utils";

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_HEIGHT = 48; // px

/** משך תצוגה נומינלי לאירוע ברשת השעות — לא כל event_type שומר משך אמיתי. */
function visualDurationMinutes(e: CalendarEvent): number {
  if (e.event_type === "confirmed_event") {
    const mins = (new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000;
    if (mins > 0 && mins < (END_HOUR - START_HOUR) * 60) return mins;
  }
  return 60;
}

/**
 * רשת שעות משותפת לתצוגת יום (days.length === 1) ותצוגת שבוע (days.length
 * === 7) — עמודה אחת לכל יום, שעות 06:00–24:00, אירועים ממוקמים לפי שעת
 * ההתחלה שלהם. לחיצה על משבצת ריקה פותחת יצירת אירוע בשעה הזו; לחיצה על
 * אירוע קיים פותחת את כרטיס הליד; קליק ימני פותח את אותו תפריט הקשר כמו
 * בתצוגת החודש.
 */
export function CalendarTimeGrid({
  days,
  eventsByDay,
  leads,
  eventTypes,
  onSlotClick,
  onEventClick,
  onEventContextMenu,
}: {
  days: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  leads: LeadEvent[];
  eventTypes: EventType[];
  onSlotClick: (day: Date, hour: number) => void;
  onEventClick: (e: CalendarEvent) => void;
  onEventContextMenu: (e: CalendarEvent, x: number, y: number) => void;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const gridHeight = hours.length * HOUR_HEIGHT;

  const eventSecondaryLabel = (e: CalendarEvent, lead: LeadEvent | undefined) => {
    if (e.event_type === "meeting" && e.meeting_id) {
      const meeting = lead?.meetings?.find((m) => m.meeting_id === e.meeting_id);
      if (meeting) return MEETING_TYPE_LABELS[meeting.type];
    }
    const eventType = lead ? eventTypes.find((t) => t.event_type_id === lead.event_type_id) : undefined;
    return eventType?.name ?? "";
  };

  return (
    <div className="flex overflow-hidden border border-border">
      <div className="w-12 shrink-0 border-l-2 border-border bg-muted/60">
        <div className="h-9 border-b-2 border-border" />
        {hours.map((h) => (
          <div key={h} className="border-b-2 border-border text-center text-[15px] text-muted-foreground" style={{ height: HOUR_HEIGHT }}>
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>
      <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((day, dayIdx) => {
          const isToday = sameDate(day, new Date());
          const dayEvents = (eventsByDay.get(day.toDateString()) ?? []).filter((e) => !isCancelledMeeting(e, leads));
          return (
            // הדגשת "היום" בגוון רקע רלוונטית רק בתצוגת שבוע, כדי להבדיל
            // מהעמודות השכנות — בתצוגת יום יש עמודה אחת בלבד, והגוון הזה
            // רק הנמיך את הניגודיות של קווי הרשת מולו.
            <div key={dayIdx} className={cn("border-l-2 border-border", isToday && days.length > 1 && "bg-primary/5")}>
              <div className="flex h-9 flex-col items-center justify-center border-b-2 border-border text-[16.5px]">
                {days.length > 1 && <span className="text-muted-foreground">{day.toLocaleDateString("he-IL", { weekday: "short" })}</span>}
                <span className={cn("font-medium", isToday && "text-primary")}>{day.getDate()}</span>
              </div>
              <div
                className="relative cursor-pointer"
                style={{ height: gridHeight }}
                onClick={(ev) => {
                  const rect = ev.currentTarget.getBoundingClientRect();
                  const offsetY = ev.clientY - rect.top;
                  const hour = START_HOUR + Math.floor(offsetY / HOUR_HEIGHT);
                  onSlotClick(day, Math.min(Math.max(hour, START_HOUR), END_HOUR - 1));
                }}
              >
                {hours.map((h) => (
                  <div key={h} className="border-b-2 border-border hover:bg-muted/40" style={{ height: HOUR_HEIGHT }} />
                ))}
                {dayEvents.map((e) => {
                  const start = new Date(e.start_time);
                  const startMinutesFromGridStart = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
                  const durationMinutes = visualDurationMinutes(e);
                  const top = Math.max(0, (startMinutesFromGridStart / 60) * HOUR_HEIGHT);
                  const height = Math.max(20, (durationMinutes / 60) * HOUR_HEIGHT - 2);
                  const lead = leads.find((l) => l.lead_id === e.lead_id);
                  const name = lead ? getEventTitle(lead) : "אירוע";
                  const typeLabel = eventSecondaryLabel(e, lead);
                  return (
                    <button
                      key={e.calendar_event_id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      onContextMenu={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        onEventContextMenu(e, ev.clientX, ev.clientY);
                      }}
                      className="absolute inset-x-0.5 overflow-hidden rounded px-1 py-0.5 text-right leading-tight hover:opacity-90"
                      style={{ top, height, background: calendarEventColor(e, leads), color: "#fff" }}
                      title={`${calendarEventLabel(e, leads)} · ${name}`}
                    >
                      <span className="block truncate text-[15.75px]">
                        {name}
                        {typeLabel && ` - ${typeLabel}`}
                      </span>
                      <span className="block truncate text-[13.5px] opacity-80">
                        {start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
