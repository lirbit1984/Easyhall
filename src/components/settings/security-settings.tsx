"use client";

import { useState } from "react";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { useLeadsStore } from "@/store/use-leads-store";

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * התראות נעילה אחרי ניסיונות PIN מחיקה כושלים (functions/src/security.ts,
 * recordLockoutAlert) — admin בלבד, גם לפי firestore.rules וגם כאן.
 */
function SecurityAlertsBanner() {
  const role = useCurrentRole();
  const alerts = useLeadsStore((s) => s.securityAlerts);
  const dismissSecurityAlert = useLeadsStore((s) => s.dismissSecurityAlert);

  if (role !== "admin" || alerts.length === 0) return null;

  return (
    <BlueprintBox className="mb-3.5 border-destructive/40">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <h3 className="font-heading text-sm font-semibold">התראות אבטחה</h3>
      </div>
      <ul className="grid gap-2">
        {alerts.map((alert) => (
          <li
            key={alert.alert_id}
            className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
          >
            <span>
              ניסיון נעילה חשוד — {alert.user_name} ב-
              {new Date(alert.created_at).toLocaleString("he-IL", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => dismissSecurityAlert(alert.alert_id)}
              aria-label="אישור צפייה"
            >
              <X className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </BlueprintBox>
  );
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
    <>
    <SecurityAlertsBanner />
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
    </>
  );
}
