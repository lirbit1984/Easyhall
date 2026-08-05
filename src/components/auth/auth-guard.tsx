"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { useOrg } from "@/lib/firebase/org-context";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";

// מחשב משותף (כמה אנשי צוות, אותו מחשב) — אם אף אחד לא נגע בעכבר/מקלדת
// שעתיים, מתנתקים לבד במקום שהסשן יישאר פתוח למי שיישב שם אחרי.
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
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

    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => signOut(auth!), IDLE_TIMEOUT_MS);
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  // Demo mode (Firebase not connected yet): render the app as-is on mock data.
  if (!isFirebaseConfigured) return <>{children}</>;

  if (loading || !user || !user.emailVerified || !profile || memberships.length === 0) {
    return <FullScreenSpinner />;
  }

  return <>{children}</>;
}
