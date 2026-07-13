"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseNotConfigured } from "@/components/auth/firebase-not-configured";

export default function LoginPage() {
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }
  return <LoginForm />;
}

function LoginForm() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signin") {
        const { user } = await signInWithEmailAndPassword(auth!, email, password);
        router.push(user.emailVerified ? "/kanban" : "/verify-email");
      } else {
        const { user } = await createUserWithEmailAndPassword(auth!, email, password);
        await sendEmailVerification(user);
        toast.success("החשבון נוצר — נשלח מייל אימות");
        router.push("/verify-email");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            EH
          </div>
          <h1 className="text-lg font-semibold">EasyHall CRM</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "התחברות לחשבון" : "יצירת חשבון חדש"}
          </p>
        </div>

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
          <div className="grid gap-1.5">
            <Label htmlFor="password">סיסמה</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "רגע..." : mode === "signin" ? "התחבר" : "צור חשבון"}
          </Button>
        </form>

        {mode === "signin" && (
          <Link
            href="/forgot-password"
            className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            שכחת סיסמה?
          </Link>
        )}

        <button
          className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "אין לך חשבון? הרשמה" : "כבר יש לך חשבון? התחברות"}
        </button>
      </Card>
    </div>
  );
}
