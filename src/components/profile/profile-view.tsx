"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { doc, setDoc } from "firebase/firestore";
import { PageHeader } from "@/components/layout/page-header";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useLeadsStore } from "@/store/use-leads-store";
import { cn } from "@/lib/utils";

const MONTH_NAMES_SHORT = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
const MONTHS_BACK = 6;

function isValidIsraeliMobile(phone: string): boolean {
  return /^05\d{8}$/.test(phone.replace(/\D/g, ""));
}

export function ProfileView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, refreshProfile } = useOrg();
  const role = useCurrentRole();
  const isAdmin = role === "admin";
  const { members } = useOrgMembers();
  const leads = useLeadsStore((s) => s.leads);
  const currentUserId = useLeadsStore((s) => s.currentUserId);

  const viewedUserId = (isAdmin && searchParams.get("user")) || currentUserId;
  const viewingSelf = viewedUserId === currentUserId;
  const viewedMember = members.find((m) => m.user_id === viewedUserId);

  const [firstName, setFirstName] = useState(profile?.fullName?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(profile?.fullName?.split(" ").slice(1).join(" ") ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !db || !isFirebaseConfigured) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("שם פרטי ושם משפחה הם שדות חובה");
      return;
    }
    if (phone.trim() && !isValidIsraeliMobile(phone)) {
      setPhoneTouched(true);
      toast.error("מספר הטלפון אינו תקין (פורמט נדרש: 05XXXXXXXX)");
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: `${firstName.trim()} ${lastName.trim()}`,
          ...(phone.trim() && { phone: phone.trim() }),
          ...(jobTitle.trim() && { jobTitle: jobTitle.trim() }),
        },
        { merge: true }
      );
      await refreshProfile();
      toast.success("הפרטים נשמרו");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const assigned = leads.filter((l) => l.assigned_user_id === viewedUserId);
    const closed = assigned.filter((l) => l.status === "closed");
    const closingRate = assigned.length > 0 ? Math.round((closed.length / assigned.length) * 100) : 0;

    const now = new Date();
    const months = Array.from({ length: MONTHS_BACK }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_BACK - 1 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    const monthlyClosings = months.map(({ year, month }) => {
      const count = closed.filter((l) => {
        const at = l.status_changed_at ? new Date(l.status_changed_at) : null;
        return at && at.getFullYear() === year && at.getMonth() === month;
      }).length;
      return { year, month, count };
    });
    const maxCount = Math.max(1, ...monthlyClosings.map((m) => m.count));

    return { assignedCount: assigned.length, closedCount: closed.length, closingRate, monthlyClosings, maxCount };
  }, [leads, viewedUserId]);

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title="הפרופיל שלי" subtitle={viewingSelf ? undefined : `מציג את הנתונים של ${viewedMember?.full_name ?? ""}`} />

      {isAdmin && (
        <div className="mx-auto mb-4 max-w-2xl">
          <Label className="mb-1.5 block text-xs text-muted-foreground">הצג נתונים של</Label>
          <Select
            value={viewedUserId}
            onValueChange={(v) => {
              if (!v) return;
              const params = new URLSearchParams(searchParams);
              if (v === currentUserId) params.delete("user");
              else params.set("user", v);
              router.push(`/profile${params.toString() ? `?${params}` : ""}`);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue>{() => members.find((m) => m.user_id === viewedUserId)?.full_name ?? "אני"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.user_id === currentUserId ? `${m.full_name} (אני)` : m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mx-auto grid max-w-2xl gap-4">
        {viewingSelf && (
          <BlueprintBox className="p-4 sm:p-6">
            <BoxKicker>פרטים אישיים</BoxKicker>
            <div className="mt-2 grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="profile_first_name">שם פרטי</Label>
                  <Input id="profile_first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="profile_last_name">שם משפחה</Label>
                  <Input id="profile_last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="profile_email">מייל</Label>
                <Input id="profile_email" dir="ltr" disabled value={user?.email ?? ""} className="text-muted-foreground" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="profile_phone">טלפון</Label>
                <Input
                  id="profile_phone"
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="050-0000000"
                />
                {phoneTouched && phone.trim() && !isValidIsraeliMobile(phone) && (
                  <p className="text-[16.5px] text-destructive">מספר לא תואם לנייד ישראלי (05XXXXXXXX)</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="profile_job_title">תפקיד</Label>
                <Input id="profile_job_title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
              <Button className="mt-1 w-fit" disabled={saving} onClick={handleSave}>
                {saving ? "שומר..." : "שמירה"}
              </Button>
            </div>
          </BlueprintBox>
        )}

        <BlueprintBox className="p-4 sm:p-6">
          <BoxKicker>ביצועים</BoxKicker>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="font-heading text-2xl font-semibold">{stats.assignedCount}</div>
              <div className="mt-0.5 text-[16.5px] text-muted-foreground">לידים בטיפול</div>
            </div>
            <div>
              <div className="font-heading text-2xl font-semibold">{stats.closedCount}</div>
              <div className="mt-0.5 text-[16.5px] text-muted-foreground">אירועים סגורים</div>
            </div>
            <div>
              <div className="font-heading text-2xl font-semibold">{stats.closingRate}%</div>
              <div className="mt-0.5 text-[16.5px] text-muted-foreground">אחוז סגירה</div>
            </div>
          </div>
        </BlueprintBox>

        <BlueprintBox className="p-4 sm:p-6">
          <BoxKicker>סגירות לפי חודש</BoxKicker>
          <div className="mt-3 flex items-end gap-2.5" style={{ height: 120 }}>
            {stats.monthlyClosings.map(({ year, month, count }, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full text-center text-[16.5px] text-muted-foreground">{count || ""}</div>
                <div
                  className={cn("w-full rounded-t-sm bg-primary/70", count === 0 && "bg-muted")}
                  style={{ height: Math.max(4, (count / stats.maxCount) * 80) }}
                />
                <div className="text-[15px] text-muted-foreground">
                  {MONTH_NAMES_SHORT[month]} {String(year).slice(2)}
                </div>
              </div>
            ))}
          </div>
        </BlueprintBox>
      </div>
    </div>
  );
}
