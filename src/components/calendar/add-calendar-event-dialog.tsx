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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeadsStore } from "@/store/use-leads-store";
import { CALENDAR_EVENT_LABELS } from "@/lib/types";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";
import { coupleDisplayName } from "@/lib/format";

/**
 * דיאלוג הוספת אירוע ליומן — משותף בין מסך היומן המלא (/calendar) ללוח
 * השנה הקטן בדשבורד, כדי ששני המקומות יתנהגו זהה (כולל בדיקת התנגשות תאריך).
 */
export function AddCalendarEventDialog({
  day,
  open,
  onOpenChange,
}: {
  day: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const leads = useLeadsStore((s) => s.leads);
  const addCalendarEvent = useLeadsStore((s) => s.addCalendarEvent);

  const [formLeadId, setFormLeadId] = useState("");
  const [formType, setFormType] = useState<CalendarEventType>("sales_meeting");
  const [formTime, setFormTime] = useState("19:00");
  const [conflict, setConflict] = useState<CalendarEvent | null>(null);
  const [pendingSave, setPendingSave] = useState<null | (() => void)>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setFormLeadId("");
      setFormType("sales_meeting");
      setFormTime("19:00");
      setConflict(null);
    }
    onOpenChange(next);
  };

  const performSave = (force = false) => {
    if (!day || !formLeadId) return;
    const [h, m] = formTime.split(":").map(Number);
    const start = new Date(day);
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
    onOpenChange(false);
    setConflict(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              הוספת אירוע ליומן {day && `· ${day.toLocaleDateString("he-IL")}`}
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
                      return l ? coupleDisplayName(l) : "בחר ליד";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.lead_id} value={l.lead_id}>
                      {coupleDisplayName(l)}
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button disabled={!formLeadId} onClick={() => performSave(false)}>
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
    </>
  );
}
