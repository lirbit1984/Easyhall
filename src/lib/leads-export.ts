import type { EventType, LeadEvent } from "./types";
import { STATUS_LABELS } from "./types";
import { getEventTitle, primaryContactName, primaryPhone, formatDate } from "./format";

export interface LeadExportRow {
  title: string;
  contactName: string;
  phone: string;
  eventType: string;
  date: string;
  status: string;
  source: string;
  assignedRep: string;
}

const LEAD_EXPORT_HEADER_LABELS: Record<keyof LeadExportRow, string> = {
  title: "כותרת הכרטיס",
  contactName: "איש קשר",
  phone: "טלפון",
  eventType: "סוג אירוע",
  date: "תאריך אירוע",
  status: "סטטוס",
  source: "מקור",
  assignedRep: "נציג משויך",
};

const LEAD_EXPORT_FIELD_ORDER: (keyof LeadExportRow)[] = [
  "title",
  "contactName",
  "phone",
  "eventType",
  "date",
  "status",
  "source",
  "assignedRep",
];

export function buildLeadsExportRows(
  leads: LeadEvent[],
  eventTypes: EventType[],
  repNamesByUserId: Record<string, string>
): LeadExportRow[] {
  return leads.map((lead) => {
    const eventType = eventTypes.find((t) => t.event_type_id === lead.event_type_id);
    return {
      title: getEventTitle(lead, eventType),
      contactName: primaryContactName(lead),
      phone: primaryPhone(lead),
      eventType: eventType?.name ?? "",
      date: formatDate(lead.event_date),
      status: STATUS_LABELS[lead.status] ?? lead.status,
      source: lead.lead_source ?? "",
      assignedRep: repNamesByUserId[lead.assigned_user_id] ?? "",
    };
  });
}

/** מוריד קובץ CSV שנפתח כברירת מחדל ב-Excel — BOM כדי שעברית תוצג נכון. */
export function downloadLeadsExportCsv(rows: LeadExportRow[], filename: string) {
  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = LEAD_EXPORT_FIELD_ORDER.map((f) => escapeCell(LEAD_EXPORT_HEADER_LABELS[f])).join(",");
  const lines = rows.map((row) => LEAD_EXPORT_FIELD_ORDER.map((f) => escapeCell(row[f])).join(","));
  const csv = [header, ...lines].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
