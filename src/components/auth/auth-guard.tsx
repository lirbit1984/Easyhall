"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useOrg } from "@/lib/firebase/org-context";
import { isFirebaseConfigured } from "@/lib/firebase/client";

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted" dir="rtl">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, memberships, loading } = useOrg();

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
    if (memberships.length === 0) {
      router.replace("/onboarding");
    }
  }, [loading, user, memberships, router]);

  // Demo mode (Firebase not connected yet): render the app as-is on mock data.
  if (!isFirebaseConfigured) return <>{children}</>;

  if (loading || !user || !user.emailVerified || memberships.length === 0) {
    return <FullScreenSpinner />;
  }

  return <>{children}</>;
}
