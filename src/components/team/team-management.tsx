"use client";

import { useState } from "react";
import { toast } from "sonner";
import { doc, setDoc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { Copy, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { useOrgMembers, type OrgMemberRow } from "@/lib/firebase/use-org-members";
import type { OrgRole } from "@/lib/firebase/types";

const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "מנהל",
  sales_rep: "נציג מכירות",
  office: "משרד",
};

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function TeamManagement() {
  const { user, currentOrgId, memberships } = useOrg();
  const { members, loading } = useOrgMembers();

  const myMembership = memberships.find((m) => m.orgId === currentOrgId);
  const isAdmin = !isFirebaseConfigured || myMembership?.role === "admin";
  const isDemo = !isFirebaseConfigured;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<OrgRole>("sales_rep");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<OrgMemberRow | null>(null);

  const openInviteDialog = () => {
    setGeneratedCode(null);
    setInviteRole("sales_rep");
    setInviteOpen(true);
  };

  const handleGenerateInvite = async () => {
    if (!currentOrgId || !user) return;
    setCreating(true);
    try {
      const code = generateInviteCode();
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      await setDoc(doc(db!, "invites", code), {
        orgId: currentOrgId,
        orgName: myMembership?.orgName ?? "",
        role: inviteRole,
        createdBy: user.uid,
        expiresAt,
      });
      setGeneratedCode(code);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה ביצירת קוד הזמנה");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    toast.success("הקוד הועתק");
  };

  const handleChangeRole = async (memberId: string, role: OrgRole) => {
    if (!currentOrgId) return;
    try {
      await updateDoc(doc(db!, "organizations", currentOrgId, "members", memberId), { role });
      toast.success("התפקיד עודכן");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בעדכון תפקיד");
    }
  };

  const handleRemove = async () => {
    if (!currentOrgId || !removeTarget) return;
    try {
      await deleteDoc(doc(db!, "organizations", currentOrgId, "members", removeTarget.user_id));
      toast.success(`${removeTarget.full_name} הוסר/ה מהצוות`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהסרת חבר צוות");
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <>
      <div className="mb-3.5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isDemo ? "מצב Demo — מוצג צוות לדוגמה" : "חברי הצוות והרשאות הגישה"}
        </p>
        {isAdmin && !isDemo && (
          <Button onClick={openInviteDialog} className="gap-1.5">
            <UserPlus className="size-4" />
            הזמן חבר צוות
          </Button>
        )}
      </div>

      <BlueprintBox className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">שם</th>
                <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">תפקיד</th>
                <th className="p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">סטטוס</th>
                {isAdmin && !isDemo && <th className="w-20 p-2.5 text-right text-[11px] font-normal uppercase tracking-[.08em] text-muted-foreground">פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-border/60">
                  <td className="p-2.5 font-medium">{m.full_name}</td>
                  <td className="p-2.5">
                    {isAdmin && !isDemo ? (
                      <Select value={m.role} onValueChange={(v) => v && handleChangeRole(m.user_id, v as OrgRole)}>
                        <SelectTrigger size="sm" className="w-36">
                          <SelectValue>{(v: string) => ROLE_LABELS[v as OrgRole]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABELS) as OrgRole[]).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="rounded-none">{ROLE_LABELS[m.role]}</Badge>
                    )}
                  </td>
                  <td className="p-2.5">
                    <Badge variant={m.is_active ? "secondary" : "destructive"} className="rounded-none">
                      {m.is_active ? "פעיל" : "לא פעיל"}
                    </Badge>
                  </td>
                  {isAdmin && !isDemo && (
                    <td className="p-2.5">
                      {m.user_id !== user?.uid && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="הסר מהצוות"
                          onClick={() => setRemoveTarget(m)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    <Users className="mx-auto mb-2 size-6" />
                    אין חברי צוות עדיין.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BlueprintBox>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>הזמנת חבר צוות</DialogTitle>
          </DialogHeader>

          {!generatedCode ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>תפקיד</Label>
                <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as OrgRole)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => ROLE_LABELS[v as OrgRole]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as OrgRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  ביטול
                </Button>
                <Button disabled={creating} onClick={handleGenerateInvite}>
                  {creating ? "רגע..." : "צור קוד הזמנה"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                שתף קוד זה עם החבר/ה החדש/ה — יש להזין אותו במסך ההצטרפות (Onboarding) בתוקף
                לשבוע ימים.
              </p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
                <code dir="ltr" className="flex-1 text-center text-lg font-bold tracking-widest">
                  {generatedCode}
                </code>
                <Button size="icon" variant="outline" onClick={handleCopyCode} title="העתק">
                  <Copy className="size-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setInviteOpen(false)}>סגור</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>הסרת חבר צוות</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            להסיר את {removeTarget?.full_name} מהצוות? הפעולה אינה הפיכה.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              ביטול
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              הסר
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
