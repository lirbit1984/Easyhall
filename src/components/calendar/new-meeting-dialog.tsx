"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeadsStore } from "@/store/use-leads-store";
import { MEETING_TYPE_LABELS, type MeetingType } from "@/lib/types";
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

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setLeadId("");
      setType("first");
      setDate("");
      setTime("");
      setNotes("");
    }
    onOpenChange(next);
  };

  const handleSave = () => {
    if (!leadId) return;
    addMeeting(leadId, type, date || null, time || null, notes);
    toast.success("הפגישה נוספה לכרטיס האירוע");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>פגישה חדשה</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>כרטיס אירוע</Label>
            <Select value={leadId} onValueChange={(v) => v && setLeadId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="בחר כרטיס אירוע">
                  {(v: string) => {
                    const l = leads.find((x) => x.lead_id === v);
                    return l ? getEventTitle(l) : "בחר כרטיס אירוע";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {leads.map((l) => (
                  <SelectItem key={l.lead_id} value={l.lead_id}>
                    {getEventTitle(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>סוג פגישה</Label>
            <Select value={type} onValueChange={(v) => v && setType(v as MeetingType)}>
              <SelectTrigger>
                <SelectValue>{(v: string) => MEETING_TYPE_LABELS[v as MeetingType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {MEETING_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new_meeting_date">תאריך</Label>
              <Input id="new_meeting_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new_meeting_time">שעה</Label>
              <Input id="new_meeting_time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="new_meeting_notes">הערות</Label>
            <Textarea
              id="new_meeting_notes"
              placeholder='למשל: "באים רק לראות את המקום" / "מגיעים עם ההורים"'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button disabled={!leadId} onClick={handleSave}>
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
