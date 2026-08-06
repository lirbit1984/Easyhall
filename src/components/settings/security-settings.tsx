"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function SecuritySettings() {
  const deletePin = useLeadsStore((s) => s.deletePin);
  const deleteUnlockPin = useLeadsStore((s) => s.deleteUnlockPin);
  const setDeletePin = useLeadsStore((s) => s.setDeletePin);
  const setDeleteUnlockPin = useLeadsStore((s) => s.setDeleteUnlockPin);

  const [newDeletePin, setNewDeletePin] = useState(deletePin);
  const [newUnlockPin, setNewUnlockPin] = useState(deleteUnlockPin);

  useEffect(() => {
    Promise.resolve().then(() => {
      setNewDeletePin(deletePin);
      setNewUnlockPin(deleteUnlockPin);
    });
  }, [deletePin, deleteUnlockPin]);

  const handleSave = () => {
    if (!isValidPin(newDeletePin) || !isValidPin(newUnlockPin)) {
      toast.error("שני הקודים חייבים להיות בני 4 ספרות");
      return;
    }
    if (newDeletePin === newUnlockPin) {
      toast.error("קוד המחיקה וקוד השחרור חייבים להיות שונים");
      return;
    }
    setDeletePin(newDeletePin);
    setDeleteUnlockPin(newUnlockPin);
    toast.success("קודי האבטחה עודכנו");
  };

  return (
    <BlueprintBox>
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <h3 className="font-heading text-sm font-semibold">מחיקת כרטיסי אירוע</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        מחיקת כרטיס אירוע היא פעולה בלתי הפיכה, מוגבלת ל-admin ומוגנת בקוד. אחרי 3 ניסיונות
        כושלים הכרטיס ננעל למחיקה עד הזנת קוד השחרור.
      </p>
      <div className="grid max-w-xs gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="delete_pin">קוד מחיקה (4 ספרות)</Label>
          <Input
            id="delete_pin"
            dir="ltr"
            maxLength={4}
            autoComplete="off"
            value={newDeletePin}
            onChange={(e) => setNewDeletePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unlock_pin">קוד שחרור נעילה (4 ספרות)</Label>
          <Input
            id="unlock_pin"
            dir="ltr"
            maxLength={4}
            autoComplete="off"
            value={newUnlockPin}
            onChange={(e) => setNewUnlockPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
        <Button type="button" onClick={handleSave} className="w-fit">
          שמור קודים
        </Button>
      </div>
    </BlueprintBox>
  );
}
