"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeadsStore } from "@/store/use-leads-store";
import { getEventTitle } from "@/lib/format";

/**
 * דיאלוג קטן לבחירת כרטיס אירוע קיים — משמש כשלב ביניים בקיצורי דרך
 * שדורשים כרטיס משוייך (כמו "הצעת מחיר" בסרגל הפעולות) אבל לא מופעלים
 * מתוך הקשר של כרטיס ספציפי.
 */
export function PickLeadDialog({
  open,
  onOpenChange,
  title,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onPick: (leadId: string) => void;
}) {
  const leads = useLeadsStore((s) => s.leads);
  const [leadId, setLeadId] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (next) setLeadId("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            disabled={!leadId}
            onClick={() => {
              onPick(leadId);
              onOpenChange(false);
            }}
          >
            המשך
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
