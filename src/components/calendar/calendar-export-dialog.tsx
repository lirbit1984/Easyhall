"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLeadsStore } from "@/store/use-leads-store";
import { useJewishHolidaysForYears } from "@/lib/use-jewish-holidays";
import { toYMD } from "@/lib/calendar-grid";
import { CalendarPrintGrid } from "@/components/calendar/calendar-print-grid";
import {
  CALENDAR_EXPORT_FIELD_LABELS,
  CALENDAR_EXPORT_FIELD_ORDER,
  buildCalendarExportRows,
  downloadCalendarExportCsv,
  fromYMD,
  monthsInRange,
  type CalendarExportField,
} from "@/lib/calendar-export";
import { elementsToPdfBlob } from "@/lib/generate-pdf";
import { cn } from "@/lib/utils";

export function CalendarExportDialog({
  open,
  onOpenChange,
  defaultYear,
  defaultMonth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultYear: number;
  defaultMonth: number;
}) {
  const leads = useLeadsStore((s) => s.leads);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);

  const monthStart = toYMD(new Date(defaultYear, defaultMonth, 1));
  const monthEnd = toYMD(new Date(defaultYear, defaultMonth + 1, 0));
  const [rangeStart, setRangeStart] = useState(monthStart);
  const [rangeEnd, setRangeEnd] = useState(monthEnd);
  const [fields, setFields] = useState<Set<CalendarExportField>>(new Set(CALENDAR_EXPORT_FIELD_ORDER));
  const [exportingPdf, setExportingPdf] = useState(false);

  const toggleField = (f: CalendarExportField) => {
    setFields((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const rangeStartDate = fromYMD(rangeStart);
  const rangeEndDate = fromYMD(rangeEnd);
  const validRange = rangeStartDate <= rangeEndDate;

  const eventsInRange = useMemo(() => {
    if (!validRange) return [];
    return calendarEvents.filter((e) => {
      const d = new Date(e.start_time);
      return d >= rangeStartDate && d <= new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), rangeEndDate.getDate(), 23, 59, 59);
    });
  }, [calendarEvents, rangeStartDate, rangeEndDate, validRange]);

  const months = useMemo(
    () => (validRange ? monthsInRange(rangeStartDate, rangeEndDate) : []),
    [rangeStartDate, rangeEndDate, validRange]
  );
  const years = useMemo(() => Array.from(new Set(months.map((m) => m.year))), [months]);
  const { labels: holidays, hebrewDates } = useJewishHolidaysForYears(years);

  const exportExcel = () => {
    if (eventsInRange.length === 0) {
      toast.error("אין אירועים בטווח התאריכים שנבחר");
      return;
    }
    const selectedFields = CALENDAR_EXPORT_FIELD_ORDER.filter((f) => fields.has(f));
    if (selectedFields.length === 0) {
      toast.error("יש לבחור לפחות שדה אחד");
      return;
    }
    const rows = buildCalendarExportRows(eventsInRange, leads, eventTypes);
    downloadCalendarExportCsv(rows, selectedFields, `יומן-האולם_${rangeStart}_${rangeEnd}.csv`);
    toast.success("קובץ האקסל הורד");
  };

  const exportPdf = async () => {
    if (eventsInRange.length === 0) {
      toast.error("אין אירועים בטווח התאריכים שנבחר");
      return;
    }
    setExportingPdf(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const elements = months
        .map((m) => document.getElementById(`calendar-print-grid-${m.year}-${m.month}`))
        .filter((el): el is HTMLElement => !!el);
      const blob = await elementsToPdfBlob(elements);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `יומן-האולם_${rangeStart}_${rangeEnd}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("קובץ ה-PDF הורד");
    } catch {
      toast.error("הפקת ה-PDF נכשלה. נסה שוב");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ייצוא יומן האולם</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>מתאריך</Label>
                <DateField value={rangeStart} onChange={setRangeStart} />
              </div>
              <div className="grid gap-1.5">
                <Label>עד תאריך</Label>
                <DateField value={rangeEnd} onChange={setRangeEnd} />
              </div>
            </div>
            {!validRange && (
              <p className="text-xs text-destructive">תאריך הסיום צריך להיות אחרי תאריך ההתחלה.</p>
            )}

            <div className="grid gap-1.5">
              <Label>שדות לקובץ האקסל</Label>
              <div className="flex flex-wrap gap-1.5">
                {CALENDAR_EXPORT_FIELD_ORDER.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleField(f)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      fields.has(f)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {CALENDAR_EXPORT_FIELD_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={!validRange} onClick={exportExcel} className="gap-1.5">
              <Download className="size-4" />
              ייצוא לאקסל
            </Button>
            <Button disabled={!validRange || exportingPdf} onClick={exportPdf} className="gap-1.5">
              <FileText className="size-4" />
              {exportingPdf ? "מפיק PDF…" : "ייצוא ל-PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* רינדור מחוץ למסך (לא display:none — כדי שהרסטור לתמונה יעבוד) של גריד
          חודש סטטי לכל חודש בטווח, עמוד אחד לכל חודש ב-PDF. */}
      <div style={{ position: "fixed", top: 0, left: -100000, pointerEvents: "none" }} aria-hidden>
        {open &&
          months.map((m) => (
            <div id={`calendar-print-grid-${m.year}-${m.month}`} key={`${m.year}-${m.month}`}>
              <CalendarPrintGrid
                year={m.year}
                month={m.month}
                events={eventsInRange}
                leads={leads}
                eventTypes={eventTypes}
                holidays={holidays}
                hebrewDates={hebrewDates}
              />
            </div>
          ))}
      </div>
    </>
  );
}
