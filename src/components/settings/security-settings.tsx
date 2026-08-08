"use client";

import { useState } from "react";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * הקודים נשמרים כ-hash ב-private/security דרך setSecurityPins, ולא נקראים
 * חזרה לדפדפן לעולם — ולכן השדות כאן מתחילים ריקים ולא מציגים את הקוד הנוכחי.
 * קודם הם ישבו בטקסט גלוי על מסמך הארגון שכל חבר צוות יכול לקרוא.
 */
export function SecuritySettings() {
  const { currentOrgId } = useOrg();
  const [newDeletePin, setNewDeletePin] = useState("");
  const [newUnlockPin, setNewUnlockPin] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isValidPin(newDeletePin) || !isValidPin(newUnlockPin)) {
      toast.error("שני הקודים חייבים להיות בני 4 ספרות");
      return;
    }
    if (newDeletePin === newUnlockPin) {
      toast.error("קוד המחיקה וקוד השחרור חייבים להיות שונים");
      return;
    }
    if (!isFirebaseConfigured || !functions || !currentOrgId) {
      toast.error("שמירת קודים זמינה רק כשהמערכת מחוברת ל-Firebase");
      return;
    }

    setSaving(true);
    try {
      const setSecurityPins = httpsCallable(functions, "setSecurityPins");
      await setSecurityPins({
        orgId: currentOrgId,
        deletePin: newDeletePin,
        deleteUnlockPin: newUnlockPin,
      });
      setNewDeletePin("");
      setNewUnlockPin("");
      toast.success("קודי האבטחה עודכנו");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שמירת הקודים נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlueprintBox>
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <h3 className="font-heading text-sm font-semibold">מחיקת כרטיסי אירוע</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        מחיקת כרטיס אירוע היא פעולה בלתי הפיכה, מוגבלת ל-admin ומוגנת בקוד. אחרי 3 ניסיונות
        כושלים המחיקה ננעלת עד הזנת קוד השחרור. הקודים נשמרים מוצפנים בשרת ואינם נקראים
        חזרה לדפדפן — הזנת קוד חדש מחליפה את הקיים.
      </p>
      <div className="grid max-w-xs gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="delete_pin">קוד מחיקה (4 ספרות)</Label>
          <Input
            id="delete_pin"
            dir="ltr"
            maxLength={4}
            autoComplete="off"
            placeholder="••••"
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
            placeholder="••••"
            value={newUnlockPin}
            onChange={(e) => setNewUnlockPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
        <Button type="button" onClick={handleSave} disabled={saving} className="w-fit">
          {saving ? "שומר..." : "שמור קודים"}
        </Button>
      </div>
    </BlueprintBox>
  );
}
