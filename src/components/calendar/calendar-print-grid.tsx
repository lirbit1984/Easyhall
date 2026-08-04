import { CALENDAR_EVENT_COLORS, MEETING_TYPE_COLORS, MEETING_TYPE_LABELS } from "@/lib/types";
import type { CalendarEvent, EventType, LeadEvent } from "@/lib/types";
import { calendarEventColor, getEventTitle, isCancelledMeeting } from "@/lib/format";
import { WEEKDAYS, MONTH_NAMES, buildMonthGrid, toYMD } from "@/lib/calendar-grid";

/**
 * גרסה סטטית (לא אינטראקטיבית) של גריד החודש, לרינדור מחוץ למסך ורסטור
 * לתמונה עבור ייצוא ה-PDF — לא ניתן להשתמש ב-CalendarView עצמו כי הוא
 * אינטראקטיבי (state, קליקים, דיאלוגים) ולא מיועד למופעים מרובים בו-זמנית
 * (עמוד לכל חודש בטווח).
 */
export function CalendarPrintGrid({
  year,
  month,
  events,
  leads,
  eventTypes,
  holidays,
  hebrewDates,
  width = 1400,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  leads: LeadEvent[];
  eventTypes: EventType[];
  holidays: Map<string, string>;
  hebrewDates: Map<string, string>;
  width?: number;
}) {
  const grid = buildMonthGrid(year, month);

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (isCancelledMeeting(e, leads)) continue;
    const key = new Date(e.start_time).toDateString();
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), e]);
  }
  for (const list of eventsByDay.values()) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  const eventSecondaryLabel = (e: CalendarEvent, lead: LeadEvent | undefined) => {
    if (e.event_type === "meeting" && e.meeting_id) {
      const meeting = lead?.meetings?.find((m) => m.meeting_id === e.meeting_id);
      if (meeting) return MEETING_TYPE_LABELS[meeting.type];
    }
    const eventType = lead ? eventTypes.find((t) => t.event_type_id === lead.event_type_id) : undefined;
    return eventType?.name ?? "";
  };

  return (
    <div dir="rtl" style={{ width, background: "#fff", fontFamily: "Heebo, sans-serif", padding: 16 }}>
      <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>
        {MONTH_NAMES[month]} {year}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", border: "1px solid #ddd" }}>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              background: "#f5f5f4",
              textAlign: "center",
              fontSize: 12,
              padding: "6px 0",
              borderBottom: "1px solid #ddd",
              color: "#666",
            }}
          >
            {d}
          </div>
        ))}
        {grid.map((day, i) => {
          const isCurrentMonth = day.getMonth() === month;
          const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
          const holiday = holidays.get(toYMD(day));
          const hebrewDate = hebrewDates.get(toYMD(day));
          return (
            <div
              key={i}
              style={{
                minHeight: 110,
                padding: 5,
                borderBottom: "1px solid #eee",
                borderLeft: "1px solid #eee",
                background: isCurrentMonth ? "#fff" : "#fafafa",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <div style={{ fontSize: 11, color: isCurrentMonth ? "#333" : "#bbb" }}>{day.getDate()}</div>
              {hebrewDate && <div style={{ fontSize: 8.5, color: "#999", lineHeight: 1.2 }}>{hebrewDate}</div>}
              {holiday && <div style={{ fontSize: 9, color: "#b45309", lineHeight: 1.2 }}>{holiday}</div>}
              {dayEvents.slice(0, 4).map((e) => {
                const lead = leads.find((l) => l.lead_id === e.lead_id);
                const name = lead ? getEventTitle(lead) : "אירוע";
                const typeLabel = eventSecondaryLabel(e, lead);
                const time = new Date(e.start_time).toLocaleTimeString("he-IL", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={e.calendar_event_id}
                    style={{
                      background: calendarEventColor(e, leads),
                      color: "#fff",
                      borderRadius: 3,
                      padding: "2px 4px",
                      fontSize: 9.5,
                      lineHeight: 1.25,
                    }}
                  >
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                      {typeLabel && ` - ${typeLabel}`}
                    </div>
                    <div style={{ opacity: 0.85, fontSize: 8.5 }}>{time}</div>
                  </div>
                );
              })}
              {dayEvents.length > 4 && (
                <div style={{ fontSize: 8.5, color: "#999" }}>+{dayEvents.length - 4} נוספים</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 9.5, color: "#666" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, background: CALENDAR_EVENT_COLORS.sales_meeting, display: "inline-block" }} />
          פגישת מכירה / סיור
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, background: CALENDAR_EVENT_COLORS.confirmed_event, display: "inline-block" }} />
          אירוע סגור
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 8, height: 8, background: CALENDAR_EVENT_COLORS.option_hold, display: "inline-block" }} />
          תאריך משוריין / אופציה
        </span>
        {(Object.keys(MEETING_TYPE_LABELS) as (keyof typeof MEETING_TYPE_LABELS)[]).map((type) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, background: MEETING_TYPE_COLORS[type], display: "inline-block" }} />
            {MEETING_TYPE_LABELS[type]}
          </span>
        ))}
      </div>
    </div>
  );
}
