"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { sendPasswordResetEmail } from "firebase/auth";
import { ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseNotConfigured } from "@/components/auth/firebase-not-configured";

export default function ForgotPasswordPage() {
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }
  return <ForgotPasswordForm />;
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth!, email);
    } catch (err) {
      // Firebase throws auth/user-not-found for unknown emails — we deliberately
      // don't surface that distinction, so the form can't be used to enumerate
      // registered accounts. Only report genuinely unexpected failures.
      if (!(err instanceof Error) || !err.message.includes("user-not-found")) {
        toast.error(err instanceof Error ? err.message : "שגיאה בשליחת המייל");
        setLoading(false);
        return;
      }
    }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <KeyRound className="mx-auto mb-3 size-8 text-primary" />
          <h1 className="text-lg font-semibold">איפוס סיסמה</h1>
          <p className="text-sm text-muted-foreground">
            {sent
              ? "אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה."
              : "הזן את כתובת האימייל שלך ונשלח קישור לאיפוס הסיסמה."}
          </p>
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "שולח..." : "שלח קישור לאיפוס"}
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3.5" />
          חזרה להתחברות
        </Link>
      </Card>
    </div>
  );
}
