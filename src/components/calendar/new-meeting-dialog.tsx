"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useLeadsStore } from "@/store/use-leads-store";
import { CLOSED_ONLY_MEETING_TYPES, MEETING_TYPE_LABELS, type MeetingType } from "@/lib/types";
import { getEventTitle } from "@/lib/format";

/**
 * קיצור דרך ליצירת פגישה מתוך סרגל הפעולות (לא בהקשר של כרטיס אירוע ספציפי) —
 * זהה לדיאלוג "פגישה חדשה" שבתוך כרטיס האירוע, בתוספת שדה בחירת כרטיס.
 */
export function NewMeetingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const leads = useLeadsStore((s) => s.leads);
  const addMeeting = useLeadsStore((s) => s.addMeeting);

  const [leadId, setLeadId] = useState("");
  const [type, setType] = useState<MeetingType>("first");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // הדיאלוג נפתח ע"י שינוי ה-prop `open` מבחוץ (סרגל הפעולות), ולכן
  // onOpenChange לא נקרא בפתיחה — איפוס הטופס חייב להיגזר מ-open עצמו,
  // אחרת submitting נשאר true אחרי שמירה וכפתור השמירה נשאר מושבת לתמיד.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLeadId("");
      setType("first");
      setDate("");
      setTime("");
      setNotes("");
      setSubmitting(false);
    }
  }

  // תיאום ציפיות מוצע רק לאירוע שנסגר. הכותרת נושאת את שם הכרטיס כדי שברשימה
  // ארוכה של פגישות ברור מיד עם מי הפגישה.
  const selectedLead = leads.find((l) => l.lead_id === leadId);
  const availableTypes = (Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).filter(
    (t) => !CLOSED_ONLY_MEETING_TYPES.includes(t) || selectedLead?.status === "closed"
  );
  const typeLabel = (t: MeetingType) =>
    CLOSED_ONLY_MEETING_TYPES.includes(t) && selectedLead
      ? `${MEETING_TYPE_LABELS[t]} עם ${getEventTitle(selectedLead)}`
      : MEETING_TYPE_LABELS[t];

  // החלפת כרטיס יכולה להשאיר סוג פגישה שכבר אינו חוקי (למשל אחרי מעבר
  // מאירוע סגור לליד פתוח) — נופלים חזרה לברירת המחדל.
  useEffect(() => {
    if (availableTypes.includes(type)) return;
    Promise.resolve().then(() => setType("first"));
  }, [availableTypes, type]);

  const handleSave = () => {
    if (submitting || !leadId) return;
    setSubmitting(true);
    addMeeting(leadId, type, date || null, time || null, notes);
    toast.success("הפגישה נוספה לכרטיס האירוע");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>פגישה חדשה</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <section className="grid gap-2 rounded-xl border border-border p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-primary">פרטי הפגישה</span>
            <div className="grid gap-1.5">
              <Label>כרטיס אירוע</Label>
              <SearchableSelect
                options={leads.map((l) => ({ value: l.lead_id, label: getEventTitle(l) }))}
                value={leadId}
                onChange={setLeadId}
                placeholder="בחר כרטיס אירוע"
                searchPlaceholder="חפש כרטיס אירוע..."
              />
            </div>

            <div className="grid gap-1.5">
              <Label>סוג פגישה</Label>
              <Select value={type} onValueChange={(v) => v && setType(v as MeetingType)}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => typeLabel(v as MeetingType)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {typeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="grid gap-2 rounded-xl border border-border p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-primary">תאריך ושעה</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="new_meeting_date">תאריך</Label>
                <DateField id="new_meeting_date" value={date} onChange={setDate} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new_meeting_time">שעה</Label>
                <TimeField id="new_meeting_time" value={time} onChange={setTime} />
              </div>
            </div>
          </section>

          <section className="grid gap-2 rounded-xl border border-border p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-primary">הערות</span>
            <Textarea
              id="new_meeting_notes"
              placeholder='למשל: "באים רק לראות את המקום" / "מגיעים עם ההורים"'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button disabled={submitting || !leadId} onClick={handleSave}>
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
