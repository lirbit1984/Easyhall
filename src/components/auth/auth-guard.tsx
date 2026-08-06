"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useOrg } from "@/lib/firebase/org-context";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// מחשב משותף (כמה אנשי צוות, אותו מחשב) — אם אף אחד לא נגע בעכבר/מקלדת
// שעתיים, מתנתקים לבד במקום שהסשן יישאר פתוח למי שיישב שם אחרי.
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const IDLE_WARNING_BEFORE_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted" dir="rtl">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, memberships, loading } = useOrg();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(IDLE_WARNING_BEFORE_MS / 1000);
  const resetTimerRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!isFirebaseConfigured || loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.emailVerified) {
      router.replace("/verify-email");
      return;
    }
    if (!profile) {
      router.replace("/profile-setup");
      return;
    }
    if (memberships.length === 0) {
      router.replace("/onboarding");
    }
  }, [loading, user, profile, memberships, router]);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;

    let warningTimer: ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;
    let countdownInterval: ReturnType<typeof setInterval>;
    // ברגע שההתראה מוצגת, תזוזת עכבר סתמית לא אמורה לסגור אותה — רק לחיצה
    // מפורשת על "המשך מחובר" מבטלת את הניתוק. לכן מתעלמים מאירועי activity
    // הפסיביים כל עוד ההתראה על המסך.
    let warningShown = false;

    const resetTimer = () => {
      warningShown = false;
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownInterval);
      setWarningOpen(false);
      warningTimer = setTimeout(() => {
        warningShown = true;
        setSecondsLeft(IDLE_WARNING_BEFORE_MS / 1000);
        setWarningOpen(true);
        countdownInterval = setInterval(() => {
          setSecondsLeft((s) => Math.max(0, s - 1));
        }, 1000);
      }, IDLE_TIMEOUT_MS - IDLE_WARNING_BEFORE_MS);
      logoutTimer = setTimeout(() => signOut(auth!), IDLE_TIMEOUT_MS);
    };
    resetTimerRef.current = resetTimer;

    const handleActivity = () => {
      if (warningShown) return;
      resetTimer();
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      clearInterval(countdownInterval);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [user]);

  // Demo mode (Firebase not connected yet): render the app as-is on mock data.
  if (!isFirebaseConfigured) return <>{children}</>;

  if (loading || !user || !user.emailVerified || !profile || memberships.length === 0) {
    return <FullScreenSpinner />;
  }

  return (
    <>
      {children}
      <Dialog open={warningOpen} onOpenChange={(open) => !open && setWarningOpen(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>עדיין שם?</DialogTitle>
            <DialogDescription>
              בשל חוסר פעילות תנותקו אוטומטית בעוד {secondsLeft} שניות.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => resetTimerRef.current()}>המשך מחובר</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
