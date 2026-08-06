import type { CalendarEvent, EventType, LeadEvent } from "./types";
import { calendarEventLabel, getEventTitle, primaryPhone } from "./format";
import { toYMD } from "./calendar-grid";

export type CalendarExportField = "date" | "time" | "name" | "type" | "status" | "phone";

export const CALENDAR_EXPORT_FIELD_LABELS: Record<CalendarExportField, string> = {
  date: "תאריך",
  time: "שעה",
  name: "שם הליד",
  type: "סוג אירוע",
  status: "סטטוס",
  phone: "טלפון",
};

export const CALENDAR_EXPORT_FIELD_ORDER: CalendarExportField[] = [
  "date",
  "time",
  "name",
  "type",
  "status",
  "phone",
];

export interface CalendarExportRow {
  date: string;
  time: string;
  name: string;
  type: string;
  status: string;
  phone: string;
}

/**
 * שורה אחת לכל אירוע יומן בטווח — סוג האירוע (type) הוא סוג האירוע של הליד
 * עצמו (חתונה/בר מצווה/וכו'), וסטטוס (status) הוא סוג הרשומה ביומן (פגישת
 * מכירה/משוריין/סגור/סוג הפגישה) — אותה הבחנה כמו בכרטיסי היומן עצמם.
 */
export function buildCalendarExportRows(
  events: CalendarEvent[],
  leads: LeadEvent[],
  eventTypes: EventType[]
): CalendarExportRow[] {
  return events
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((e) => {
      const lead = leads.find((l) => l.lead_id === e.lead_id);
      const start = new Date(e.start_time);
      const eventType = lead ? eventTypes.find((t) => t.event_type_id === lead.event_type_id) : undefined;
      return {
        date: start.toLocaleDateString("he-IL"),
        time: start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
        name: lead ? getEventTitle(lead) : "אירוע",
        type: eventType?.name ?? "",
        status: calendarEventLabel(e, leads),
        phone: lead ? primaryPhone(lead) : "",
      };
    });
}

/** מוריד קובץ CSV שנפתח כברירת מחדל ב-Excel — BOM כדי שעברית תוצג נכון. */
export function downloadCalendarExportCsv(rows: CalendarExportRow[], fields: CalendarExportField[], filename: string) {
  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = fields.map((f) => escapeCell(CALENDAR_EXPORT_FIELD_LABELS[f])).join(",");
  const lines = rows.map((row) => fields.map((f) => escapeCell(row[f])).join(","));
  const csv = [header, ...lines].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** כל צירופי {year, month} שהטווח [start, end] נוגע בהם, בסדר כרונולוגי. */
export function monthsInRange(start: Date, end: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function fromYMD(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export { toYMD };
