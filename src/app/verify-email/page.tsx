"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendEmailVerification, signOut } from "firebase/auth";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseNotConfigured } from "@/components/auth/firebase-not-configured";
import { useOrg } from "@/lib/firebase/org-context";

export default function VerifyEmailPage() {
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }
  return <VerifyEmailContent />;
}

function VerifyEmailContent() {
  const router = useRouter();
  const { user, loading: orgLoading } = useOrg();
  const [checking, setChecking] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // auth.currentUser is a synchronous snapshot that's null until Firebase's
  // SDK finishes restoring the session — on a hard refresh it stays empty
  // forever here since nothing re-renders this component when it resolves.
  // useOrg().user comes from onAuthStateChanged, so it updates reactively.
  const email = user?.email ?? "";

  useEffect(() => {
    if (!orgLoading && !user) {
      router.replace("/login");
    }
  }, [orgLoading, user, router]);

  const checkVerified = async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return;
    await currentUser.reload();
    if (auth!.currentUser?.emailVerified) {
      router.push("/profile-setup");
    }
  };

  // Poll quietly in the background so a user who verifies in another tab
  // lands in the app without needing to click back here manually.
  useEffect(() => {
    const interval = setInterval(() => {
      checkVerified();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckNow = async () => {
    setChecking(true);
    await checkVerified();
    setChecking(false);
  };

  const handleResend = async () => {
    const user = auth?.currentUser;
    if (!user) return;
    try {
      await sendEmailVerification(user);
      toast.success("מייל אימות נשלח מחדש");
      setResendCooldown(30);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשליחת המייל");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth!);
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6 text-center">
        <MailCheck className="mx-auto mb-3 size-8 text-primary" />
        <h1 className="mb-1 text-lg font-semibold">אמת את כתובת האימייל שלך</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          שלחנו קישור אימות ל-<span dir="ltr" className="font-medium text-foreground">{email}</span>.
          יש ללחוץ עליו כדי להמשיך למערכת.
        </p>

        <div className="grid gap-2">
          <Button onClick={handleCheckNow} disabled={checking}>
            {checking ? "בודק..." : "כבר אימתתי — המשך"}
          </Button>
          <Button variant="outline" onClick={handleResend} disabled={resendCooldown > 0}>
            {resendCooldown > 0 ? `שלח שוב (${resendCooldown})` : "שלח מייל אימות שוב"}
          </Button>
          <button
            className="mt-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            התנתק
          </button>
        </div>
      </Card>
    </div>
  );
}
