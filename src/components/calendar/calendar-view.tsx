"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeadsStore } from "@/store/use-leads-store";
import {
  CALENDAR_EVENT_COLORS,
  CALENDAR_EVENT_LABELS,
} from "@/lib/types";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const MONTH_NAMES = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarView() {
  const [cursor, setCursor] = useState(() => new Date());
  const leads = useLeadsStore((s) => s.leads);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);
  const addCalendarEvent = useLeadsStore((s) => s.addCalendarEvent);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [formLeadId, setFormLeadId] = useState<string>("");
  const [formType, setFormType] = useState<CalendarEventType>("sales_meeting");
  const [formTime, setFormTime] = useState("19:00");
  const [conflict, setConflict] = useState<CalendarEvent | null>(null);
  const [pendingSave, setPendingSave] = useState<null | (() => void)>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

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
    setFormLeadId("");
    setFormType("sales_meeting");
    setFormTime("19:00");
    setAddOpen(true);
  };

  const performSave = (force = false) => {
    if (!selectedDay || !formLeadId) return;
    const [h, m] = formTime.split(":").map(Number);
    const start = new Date(selectedDay);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 0, 0);

    const result = addCalendarEvent(formLeadId, formType, start.toISOString(), end.toISOString(), force);
    if (!result.success && result.conflict) {
      setConflict(result.conflict);
      setPendingSave(() => () => performSave(true));
      return;
    }
    toast.success("האירוע נוסף ליומן האולם");
    setAddOpen(false);
    setConflict(null);
  };

  return (
    <div className="p-3 sm:p-4">
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
            <span className="size-2.5 rounded-full" style={{ background: CALENDAR_EVENT_COLORS.sales_meeting }} />
            פגישת מכירה / סיור
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: CALENDAR_EVENT_COLORS.confirmed_event }} />
            אירוע סגור
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: CALENDAR_EVENT_COLORS.option_hold }} />
            תאריך משוריין / אופציה
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b bg-muted/60 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {grid.map((day, i) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = sameDate(day, new Date());
          const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
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
                    "flex size-5 items-center justify-center rounded-full text-[11px]",
                    isToday && "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {day.getDate()}
                </span>
                <Plus className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const lead = leads.find((l) => l.lead_id === e.lead_id);
                  return (
                    <div
                      key={e.calendar_event_id}
                      className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                      style={{ background: CALENDAR_EVENT_COLORS[e.event_type] }}
                      title={`${CALENDAR_EVENT_LABELS[e.event_type]} · ${lead?.partner_1_name ?? ""}`}
                    >
                      {lead?.partner_1_name ?? "אירוע"}
                    </div>
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

      {/* Add event dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              הוספת אירוע ליומן {selectedDay && `· ${selectedDay.toLocaleDateString("he-IL")}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>ליד / זוג</Label>
              <Select value={formLeadId} onValueChange={(v) => v && setFormLeadId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר ליד">
                    {(v: string) => {
                      const l = leads.find((x) => x.lead_id === v);
                      return l ? `${l.partner_1_name} & ${l.partner_2_name}` : "בחר ליד";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.lead_id} value={l.lead_id}>
                      {l.partner_1_name} & {l.partner_2_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>סוג אירוע</Label>
              <Select value={formType} onValueChange={(v) => v && setFormType(v as CalendarEventType)}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => CALENDAR_EVENT_LABELS[v as CalendarEventType]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CALENDAR_EVENT_LABELS) as CalendarEventType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {CALENDAR_EVENT_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>שעה</Label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              ביטול
            </Button>
            <Button disabled={!formLeadId} onClick={() => performSave(false)}>
              שמור ביומן
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collision warning */}
      <AlertDialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              התאריך תפוס ביומן האולם!
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conflict && (
                <>
                  בתאריך זה כבר קיים{" "}
                  <Badge variant="destructive">{CALENDAR_EVENT_LABELS[conflict.event_type]}</Badge> עבור ליד אחר (
                  {leads.find((l) => l.lead_id === conflict.lead_id)?.partner_1_name ?? "לא ידוע"}
                  ). לא ניתן לשריין/לסגור אירוע נוסף באותו תאריך ללא אישור מנהל.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflict(null)}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                pendingSave?.();
              }}
            >
              אישור מנהל - שריין בכל זאת
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
