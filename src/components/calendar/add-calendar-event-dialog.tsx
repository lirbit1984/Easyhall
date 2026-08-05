"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { TimeField } from "@/components/ui/time-field";
import { DateField } from "@/components/ui/date-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useLeadsStore } from "@/store/use-leads-store";
import { CALENDAR_EVENT_LABELS, CLOSED_ONLY_MEETING_TYPES, MEETING_TYPE_LABELS } from "@/lib/types";
import type { CalendarEvent, MeetingType } from "@/lib/types";
import { getEventTitle } from "@/lib/format";
import { toYMD } from "@/lib/calendar-grid";

const OPTION_HOLD = "option_hold" as const;
type FormKind = MeetingType | typeof OPTION_HOLD;

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return toYMD(next);
}

/**
 * דיאלוג הוספת אירוע ליומן — משותף בין מסך היומן המלא (/calendar) ללוח
 * השנה הקטן בדשבורד. יוצר או פגישה אמיתית (אותה addMeeting שכרטיס הליד
 * משתמש בו — מופיעה בטאב "פגישות", מתועדת בפעילות, ומסתנכרנת ליומן) או
 * שריון תאריך עם תוקף (option_hold), שיוצר גם מטלת מעקב בכרטיס הליד.
 * "אירוע סגור" לא נבחר כאן בכלל — הוא נגזר רק מסטטוס הליד בכרטיס עצמו.
 */
export function AddCalendarEventDialog({
  day,
  open,
  onOpenChange,
  initialTime,
}: {
  day: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** שעה התחלתית לטופס (מ-HH:mm) — למשל בלחיצה על משבצת שעה בתצוגת יום/שבוע. */
  initialTime?: string;
}) {
  const leads = useLeadsStore((s) => s.leads);
  const addMeeting = useLeadsStore((s) => s.addMeeting);
  const reserveDate = useLeadsStore((s) => s.reserveDate);

  const [formLeadId, setFormLeadId] = useState("");
  const [formKind, setFormKind] = useState<FormKind>("first");
  const [formTime, setFormTime] = useState(initialTime ?? "19:00");
  const [holdExpiry, setHoldExpiry] = useState("");
  const [conflict, setConflict] = useState<CalendarEvent | null>(null);
  const [pendingSave, setPendingSave] = useState<null | (() => void)>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedLead = leads.find((l) => l.lead_id === formLeadId);
  const availableMeetingTypes = (Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).filter(
    (t) => !CLOSED_ONLY_MEETING_TYPES.includes(t) || selectedLead?.status === "closed"
  );

  // הדיאלוג נפתח ע"י שינוי ה-prop `open` מבחוץ, ולכן onOpenChange לא נקרא
  // בפתיחה — איפוס הטופס חייב להיגזר מ-open עצמו, אחרת submitting נשאר
  // true אחרי שמירה וכפתור השמירה נשאר מושבת לתמיד.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFormLeadId("");
      setFormKind("first");
      setFormTime(initialTime ?? "19:00");
      setHoldExpiry(day ? addDays(toYMD(day), 7) : "");
      setConflict(null);
      setSubmitting(false);
    }
  }

  const performSave = (force = false) => {
    if (!day || !formLeadId) return;
    if (!force) {
      if (submitting) return;
      setSubmitting(true);
    }
    const dateYMD = toYMD(day);

    if (formKind === OPTION_HOLD) {
      const [h, m] = formTime.split(":").map(Number);
      const start = new Date(day);
      start.setHours(h, m, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 0, 0);
      const expiry = new Date(holdExpiry || addDays(dateYMD, 7));
      expiry.setHours(23, 59, 0, 0);

      const result = reserveDate(formLeadId, start.toISOString(), end.toISOString(), expiry.toISOString(), force);
      if (!result.success && result.conflict) {
        setConflict(result.conflict);
        setPendingSave(() => () => performSave(true));
        return;
      }
      toast.success("התאריך שוריין ביומן האולם");
    } else {
      addMeeting(formLeadId, formKind, dateYMD, formTime, "");
      toast.success("הפגישה נוספה לכרטיס הליד");
    }
    onOpenChange(false);
    setConflict(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              הוספת אירוע ליומן {day && `· ${day.toLocaleDateString("he-IL")}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>ליד / זוג</Label>
              <SearchableSelect
                options={leads.map((l) => ({ value: l.lead_id, label: getEventTitle(l) }))}
                value={formLeadId}
                onChange={setFormLeadId}
                placeholder="בחר ליד"
                searchPlaceholder="חפש ליד..."
              />
            </div>

            <div className="grid gap-1.5">
              <Label>סוג</Label>
              <Select value={formKind} onValueChange={(v) => v && setFormKind(v as FormKind)}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => (v === OPTION_HOLD ? CALENDAR_EVENT_LABELS.option_hold : MEETING_TYPE_LABELS[v as MeetingType])}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableMeetingTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {MEETING_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                  <SelectItem value={OPTION_HOLD}>{CALENDAR_EVENT_LABELS.option_hold}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>שעה</Label>
              <TimeField value={formTime} onChange={setFormTime} />
            </div>

            {formKind === OPTION_HOLD && (
              <div className="grid gap-1.5">
                <Label>השריון בתוקף עד</Label>
                <DateField value={holdExpiry} onChange={setHoldExpiry} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button disabled={submitting || !formLeadId} onClick={() => performSave(false)}>
              שמור ביומן
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {(() => {
                    const conflictLead = leads.find((l) => l.lead_id === conflict.lead_id);
                    return conflictLead ? getEventTitle(conflictLead) : "לא ידוע";
                  })()}
                  ). לא ניתן לשריין אירוע נוסף באותו תאריך ללא אישור מנהל.
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
    </>
  );
}
