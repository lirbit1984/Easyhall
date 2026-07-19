"use client";

import { useState } from "react";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { CreditCard, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";

export function PaymentSettings() {
  const { currentOrgId } = useOrg();
  const { orgDoc, loading } = useOrgDoc();

  const [growUserId, setGrowUserId] = useState("");
  const [growPageCode, setGrowPageCode] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [saving, setSaving] = useState(false);

  const connected = !!orgDoc?.paymentConnected;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured || !functions || !currentOrgId) {
      toast.error("חיבור סליקה זמין רק כשהמערכת מחוברת ל-Firebase");
      return;
    }
    setSaving(true);
    try {
      const setPaymentCredentials = httpsCallable(functions, "setPaymentCredentials");
      await setPaymentCredentials({
        orgId: currentOrgId,
        growUserId: growUserId.trim(),
        growPageCode: growPageCode.trim(),
        sandbox,
      });
      toast.success("חשבון ה-Grow חובר בהצלחה — קישורי תשלום אמיתיים פעילים");
      setGrowUserId("");
      setGrowPageCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירת פרטי הסליקה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <h2 className="text-base">סליקת אשראי — Grow</h2>
          {connected && (
            <span className="mr-auto flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              מחובר
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          חיבור חשבון ה-Grow (משולם) של האולם מאפשר לשלוח לזוגות קישורי תשלום אמיתיים
          למקדמות. המקדמה מסומנת כשולמה אוטומטית ברגע שהתשלום עובר.
        </p>

        <Separator className="my-4" />

        {loading ? (
          <p className="text-sm text-muted-foreground">טוען...</p>
        ) : (
          <form onSubmit={handleSave} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="grow_user_id">Grow userId</Label>
              <Input
                id="grow_user_id"
                dir="ltr"
                required
                value={growUserId}
                onChange={(e) => setGrowUserId(e.target.value)}
                placeholder={connected ? "•••••• (מחובר — מלא רק כדי להחליף)" : ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="grow_page_code">Grow pageCode</Label>
              <Input
                id="grow_page_code"
                dir="ltr"
                required
                value={growPageCode}
                onChange={(e) => setGrowPageCode(e.target.value)}
                placeholder={connected ? "•••••• (מחובר — מלא רק כדי להחליף)" : ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sandbox} onCheckedChange={(v) => setSandbox(!!v)} />
              סביבת בדיקות (Sandbox) — לניסויים לפני חיבור החשבון האמיתי
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "שומר..." : connected ? "עדכן פרטי חיבור" : "חבר חשבון Grow"}
              </Button>
              <a
                href="https://grow.business/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                אין לך חשבון Grow? פתיחה מהירה אונליין
                <ExternalLink className="size-3.5" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              את ה-userId וה-pageCode מוצאים באזור האישי של Grow תחת הגדרות מפתחים / דפי
              תשלום. הפרטים נשמרים מוצפנים בשרת ואינם נגישים מהדפדפן.
            </p>
          </form>
        )}
    </BlueprintBox>
  );
}
