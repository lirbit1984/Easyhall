"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import {
  confirmPasswordReset,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from "firebase/auth";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { auth, functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseNotConfigured } from "@/components/auth/firebase-not-configured";

export default function ActivatePage() {
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }
  return <ActivateForm />;
}

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [status, setStatus] = useState<"checking" | "ready" | "invalid">(oobCode ? "checking" : "invalid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!oobCode) return;
    verifyPasswordResetCode(auth!, oobCode)
      .then((resolvedEmail) => {
        setEmail(resolvedEmail);
        setStatus("ready");
      })
      .catch(() => setStatus("invalid"));
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    if (password.length < 6) {
      toast.error("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("הסיסמאות אינן תואמות.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(auth!, oobCode, password);
      await signInWithEmailAndPassword(auth!, email, password);
      const activateAccount = httpsCallable(functions!, "activateAccount");
      await activateAccount({});
      toast.success("החשבון הופעל בהצלחה");
      router.push("/kanban");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהפעלת החשבון");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6">
        {status === "checking" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">בודק את הקישור...</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center">
            <h1 className="mb-1 text-lg font-semibold">הקישור לא תקין</h1>
            <p className="text-sm text-muted-foreground">
              הקישור פג תוקף או שכבר נעשה בו שימוש. פנו למי שהזמין אתכם לצוות לקבלת קישור חדש.
            </p>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="mb-5 text-center">
              <KeyRound className="mx-auto mb-2 size-6 text-primary" />
              <h1 className="text-lg font-semibold">קביעת סיסמה</h1>
              <p className="text-sm text-muted-foreground">
                מפעילים את החשבון עבור <span dir="ltr" className="font-medium text-foreground">{email}</span>
              </p>
            </div>
            <form onSubmit={handleSubmit} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="password">סיסמה חדשה</Label>
                <Input
                  id="password"
                  type="password"
                  dir="ltr"
                  required
                  disabled={submitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="confirm_password">אימות סיסמה</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  dir="ltr"
                  required
                  disabled={submitting}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting} className="mt-1">
                {submitting ? "רגע..." : "הפעל את החשבון"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
