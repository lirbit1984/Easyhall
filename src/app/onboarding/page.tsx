"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { FirebaseNotConfigured } from "@/components/auth/firebase-not-configured";

export default function OnboardingPage() {
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }
  return <OnboardingForm />;
}

function OnboardingForm() {
  const router = useRouter();
  const { user, loading: orgLoading, refreshMemberships } = useOrg();

  useEffect(() => {
    if (orgLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.emailVerified) {
      router.replace("/verify-email");
    }
  }, [user, orgLoading, router]);

  const [mode, setMode] = useState<"create" | "join">("create");
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Both flows run entirely server-side (Cloud Functions, Admin SDK) — the
  // client never writes organizations/members documents directly anymore.
  // This is what actually closes the "self-assign admin" gap: redeemInvite
  // assigns exactly the role the invite specifies, not whatever the caller asks for.

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const createOrganization = httpsCallable(functions!, "createOrganization");
      await createOrganization({ orgName, fullName });
      toast.success(`האולם "${orgName}" נוצר בהצלחה`);
      await refreshMemberships();
      router.push("/kanban");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה ביצירת הארגון");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const redeemInvite = httpsCallable(functions!, "redeemInvite");
      await redeemInvite({ code: inviteCode.trim(), fullName });
      toast.success("הצטרפת לארגון בהצלחה");
      await refreshMemberships();
      router.push("/kanban");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהצטרפות לארגון");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <h1 className="text-lg font-semibold">ברוכים הבאים ל-EasyHall</h1>
          <p className="text-sm text-muted-foreground">כדי להתחיל, צרו אולם חדש או הצטרפו לאולם קיים</p>
        </div>

        <Tabs value={mode} onValueChange={(v) => v && setMode(v as "create" | "join")}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="create" className="flex-1">
              אולם חדש
            </TabsTrigger>
            <TabsTrigger value="join" className="flex-1">
              הצטרפות לאולם קיים
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "create" ? (
          <form onSubmit={handleCreate} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="full_name">שמך המלא</Label>
              <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="org_name">שם האולם</Label>
              <Input id="org_name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "רגע..." : "צור אולם והתחל"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="full_name_join">שמך המלא</Label>
              <Input
                id="full_name_join"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite_code">קוד הזמנה</Label>
              <Input
                id="invite_code"
                dir="ltr"
                required
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
