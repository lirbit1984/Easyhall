"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FirebaseError } from "firebase/app";
import { functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { FirebaseNotConfigured } from "@/components/auth/firebase-not-configured";

// הודעות עבור קודי שגיאה של Cloud Functions שאינם HttpsError עסקי (רשת/זמינות) —
// אלה מגיעים עם הודעה גולמית באנגלית מה-SDK, בניגוד לשגיאות שהפונקציות עצמן
// זורקות (HttpsError) שכבר כוללות הודעה בעברית ומגיעות דרך err.message כרגיל.
const FUNCTIONS_ERROR_MESSAGES: Record<string, string> = {
  "functions/unavailable": "אין חיבור לשרת כרגע. בדקו את החיבור לאינטרנט ונסו שוב.",
  "functions/deadline-exceeded": "הפעולה ארכה זמן רב מדי. נסו שוב.",
  "functions/internal": "אירעה שגיאה בשרת. נסו שוב בעוד רגע.",
  "functions/cancelled": "הפעולה בוטלה. נסו שוב.",
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof FirebaseError && err.code in FUNCTIONS_ERROR_MESSAGES) {
    return FUNCTIONS_ERROR_MESSAGES[err.code];
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function OnboardingPage() {
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: orgLoading, refreshMemberships } = useOrg();

  useEffect(() => {
    if (orgLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.emailVerified) {
      router.replace("/verify-email");
    } else if (!profile) {
      router.replace("/profile-setup");
    }
  }, [user, profile, orgLoading, router]);

  // קישור-הזמנה (?join=CODE) פותח ישר בטאב "הצטרפות" עם הקוד ממולא, ומסתיר את
  // טאב "אולם חדש" — מי שקיבל הזמנה לצוות לא אמור להיתקל באפשרות ליצור אולם
  // נפרד בטעות.
  const joinCode = searchParams.get("join");
  const [mode, setMode] = useState<"create" | "join">(joinCode ? "join" : "create");
  const [orgName, setOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState(joinCode ?? "");
  const [loading, setLoading] = useState(false);

  // Both flows run entirely server-side (Cloud Functions, Admin SDK) — the
  // client never writes organizations/members documents directly anymore.
  // This is what actually closes the "self-assign admin" gap: redeemInvite
  // assigns exactly the role the invite specifies, not whatever the caller asks for.
  // fullName is no longer collected here — the functions read it from the
  // caller's users/{uid} profile doc (set in /profile-setup), so a person's
  // display name has a single source of truth across every org they join.

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOrgName = orgName.trim();
    if (!trimmedOrgName) {
      toast.error("שם האולם הוא שדה חובה.");
      return;
    }
    setLoading(true);
    try {
      const createOrganization = httpsCallable(functions!, "createOrganization");
      await createOrganization({ orgName: trimmedOrgName });
      toast.success(`האולם "${trimmedOrgName}" נוצר בהצלחה`);
      await refreshMemberships();
      router.push("/kanban");
    } catch (err) {
      toast.error(getErrorMessage(err, "שגיאה ביצירת הארגון"));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = inviteCode.trim();
    if (!trimmedCode) {
      toast.error("קוד הזמנה הוא שדה חובה.");
      return;
    }
    setLoading(true);
    try {
      const redeemInvite = httpsCallable(functions!, "redeemInvite");
      await redeemInvite({ code: trimmedCode });
      toast.success("הצטרפת לארגון בהצלחה");
      await refreshMemberships();
      router.push("/kanban");
    } catch (err) {
      toast.error(getErrorMessage(err, "שגיאה בהצטרפות לארגון"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <h1 className="text-lg font-semibold">ברוכים הבאים ל-EasyHall</h1>
          <p className="text-sm text-muted-foreground">
            {joinCode ? "הוזמנתם להצטרף לאולם — אשרו את הפרטים" : "כדי להתחיל, צרו אולם חדש או הצטרפו לאולם קיים"}
          </p>
        </div>

        {!joinCode && (
          <Tabs value={mode} onValueChange={(v) => !loading && v && setMode(v as "create" | "join")}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="create" className="flex-1" disabled={loading}>
                אולם חדש
              </TabsTrigger>
              <TabsTrigger value="join" className="flex-1" disabled={loading}>
                הצטרפות לאולם קיים
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {mode === "create" ? (
          <form onSubmit={handleCreate} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="org_name">שם האולם</Label>
              <Input
                id="org_name"
                required
                disabled={loading}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "רגע..." : "צור אולם והתחל"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="invite_code">קוד הזמנה</Label>
              <Input
                id="invite_code"
                dir="ltr"
                required
                disabled={loading}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "רגע..." : "הצטרף לאולם"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
