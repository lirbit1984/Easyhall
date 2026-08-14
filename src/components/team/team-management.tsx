"use client";

import { useState } from "react";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";
import { Mail, Settings2, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db, functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { useOrgMembers, type OrgMemberRow } from "@/lib/firebase/use-org-members";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { useLeadsStore } from "@/store/use-leads-store";
import { ROLE_LABELS, PERMISSION_AREAS } from "@/lib/firebase/types";
import type { OrgRole, PermissionAreaKey, PermissionLevel } from "@/lib/firebase/types";

const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  edit: "עריכה",
  view: "צפייה",
  none: "אין הרשאה",
};

export function TeamManagement() {
  const { user, currentOrgId, memberships } = useOrg();
  const { members, loading } = useOrgMembers();
  const { orgDoc } = useOrgDoc();
  const setOrgRoleDefaultPermission = useLeadsStore((s) => s.setOrgRoleDefaultPermission);

  const myMembership = memberships.find((m) => m.orgId === currentOrgId);
  const isAdmin = !isFirebaseConfigured || myMembership?.role === "admin";
  const isDemo = !isFirebaseConfigured;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("sales_rep");
  const [inviteSent, setInviteSent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<OrgMemberRow | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  // לא מתאפס ל-null בסגירה בכוונה: החלונית דוהה החוצה באנימציה, וריקון היעד
  // באותו רגע היה גורם לתוכן להתחלף (כותרת ריקה, כל התחומים "אין הרשאה")
  // באמצע הדעיכה. היעד נשאר "אחרון ידוע" עד שנפתח שוב עבור מישהו אחר.
  const [permissionsTarget, setPermissionsTarget] = useState<OrgMemberRow | null>(null);
  const openPermissions = (m: OrgMemberRow) => {
    setPermissionsTarget(m);
    setPermissionsOpen(true);
  };
  const [removing, setRemoving] = useState(false);
  const [roleDefaultsOpen, setRoleDefaultsOpen] = useState(false);
  const [roleDefaultsRole, setRoleDefaultsRole] = useState<OrgRole>("sales_rep");

  const levelForMember = (m: OrgMemberRow, key: PermissionAreaKey): PermissionLevel =>
    m.permissions?.areas?.[key] ?? orgDoc?.roleDefaultPermissions?.[m.role]?.[key] ?? "none";

  const openInviteDialog = () => {
    setInviteFirstName("");
    setInviteLastName("");
    setInviteEmail("");
    setInviteRole("sales_rep");
    setInviteSent(false);
    setInviteOpen(true);
  };

  const handleSendInvite = async () => {
    if (!currentOrgId) return;
    const firstName = inviteFirstName.trim();
    const lastName = inviteLastName.trim();
    const email = inviteEmail.trim();
    if (!firstName || !lastName) {
      toast.error("יש להזין שם פרטי ושם משפחה.");
      return;
    }
    if (!email) {
      toast.error("יש להזין כתובת מייל.");
      return;
    }
    setCreating(true);
    try {
      const inviteTeamMember = httpsCallable(functions!, "inviteTeamMember");
      await inviteTeamMember({ orgId: currentOrgId, firstName, lastName, email, role: inviteRole });
      setInviteSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשליחת ההזמנה");
    } finally {
      setCreating(false);
    }
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

  const handleSetAreaLevel = async (memberId: string, area: PermissionAreaKey, level: PermissionLevel) => {
    if (!isFirebaseConfigured || !currentOrgId) {
      toast.error("לא מחובר לארגון — רענן את הדף ונסה שוב");
      return;
    }
    try {
      await updateDoc(doc(db!, "organizations", currentOrgId, "members", memberId), {
        [`permissions.areas.${area}`]: level,
      });
      toast.success("ההרשאה עודכנה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "עדכון ההרשאה נכשל");
    }
  };

  const handleRemove = async () => {
    if (!currentOrgId || !removeTarget) return;
    setRemoving(true);
    try {
      const removeTeamMember = httpsCallable(functions!, "removeTeamMember");
      await removeTeamMember({ orgId: currentOrgId, memberId: removeTarget.user_id });
      toast.success(`${removeTarget.full_name} הוסר/ה מהצוות`);
      setRemoveTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהסרת חבר צוות");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <div className="mb-3.5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isDemo ? "מצב Demo — מוצג צוות לדוגמה" : "חברי הצוות והרשאות הגישה"}
        </p>
        {isAdmin && !isDemo && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setRoleDefaultsOpen(true)} className="gap-1.5">
              <ShieldCheck className="size-4" />
              הרשאות ברירת מחדל
            </Button>
            <Button onClick={openInviteDialog} className="gap-1.5">
              <UserPlus className="size-4" />
              הזמן חבר צוות
            </Button>
          </div>
        )}
      </div>

      <BlueprintBox className="min-w-0 p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">שם</th>
                <th className="p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">תפקיד</th>
                <th className="p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">סטטוס</th>
                {isAdmin && !isDemo && <th className="w-20 p-2.5 text-right text-[16.5px] font-normal uppercase tracking-[.08em] text-muted-foreground">פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-border/60">
                  <td className="p-2.5 font-medium">
                    {isAdmin && !isDemo ? (
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => openPermissions(m)}
                        title="ניהול הרשאות"
                      >
                        {m.full_name}
                      </button>
                    ) : (
                      m.full_name
                    )}
                  </td>
                  <td className="p-2.5">
                    {isAdmin && !isDemo && m.user_id !== user?.uid ? (
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
                      <Badge variant="secondary" className="rounded-full">{ROLE_LABELS[m.role]}</Badge>
                    )}
                  </td>
                  <td className="p-2.5">
                    {m.status === "pending" ? (
                      <Badge variant="outline" className="rounded-full border-amber-500 text-amber-600">
                        ממתין להפעלה
                      </Badge>
                    ) : (
                      <Badge variant={m.is_active ? "secondary" : "destructive"} className="rounded-full">
                        {m.is_active ? "פעיל" : "לא פעיל"}
                      </Badge>
                    )}
                  </td>
                  {isAdmin && !isDemo && (
                    <td className="flex items-center gap-1 p-2.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        title="ניהול הרשאות"
                        onClick={() => openPermissions(m)}
                      >
                        <Settings2 className="size-3.5" />
                      </Button>
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
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
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

          {!inviteSent ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="invite_first_name">שם פרטי</Label>
                  <Input
                    id="invite_first_name"
                    disabled={creating}
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="invite_last_name">שם משפחה</Label>
                  <Input
                    id="invite_last_name"
                    disabled={creating}
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="invite_email">מייל</Label>
                <Input
                  id="invite_email"
                  type="email"
                  dir="ltr"
                  disabled={creating}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>תפקיד</Label>
                <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as OrgRole)}>
                  <SelectTrigger className="w-full" disabled={creating}>
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
                <Button variant="outline" disabled={creating} onClick={() => setInviteOpen(false)}>
                  ביטול
                </Button>
                <Button disabled={creating} onClick={handleSendInvite} className="gap-1.5">
                  <Mail className="size-4" />
                  {creating ? "שולח..." : "שלח הזמנה במייל"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                נשלח מייל הזמנה ל-<span dir="ltr">{inviteEmail}</span>. ברגע שיקבע סיסמה, הסטטוס שלו
                יתעדכן מ&quot;ממתין להפעלה&quot; ל&quot;פעיל&quot; ברשימת הצוות.
              </p>
              <DialogFooter>
                <Button onClick={() => setInviteOpen(false)}>סגור</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* מטריצת הרשאות פר-חבר */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הרשאות — {permissionsTarget?.full_name}</DialogTitle>
          </DialogHeader>
          {permissionsTarget?.role === "admin" ? (
            <p className="text-sm text-muted-foreground">
              מנהל תמיד עם גישה מלאה לכל המערכת — מטריצת ההרשאות לא חלה על תפקיד זה.
            </p>
          ) : (
          <>
          <p className="text-xs text-muted-foreground">
            ברירת המחדל נגזרת מהתפקיד ({permissionsTarget ? ROLE_LABELS[permissionsTarget.role] : ""}) — כאן אפשר
            לדייק הרשאה נקודתית לתחום ספציפי.
          </p>
          <div className="grid gap-2.5">
            {PERMISSION_AREAS.map(({ key, label }) => {
              const liveTarget = members.find((m) => m.user_id === permissionsTarget?.user_id);
              const level = liveTarget ? levelForMember(liveTarget, key) : "none";
              const hasOverride = liveTarget?.permissions?.areas?.[key] !== undefined;
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <Label className="text-sm">
                    {label}
                    {!hasOverride && <span className="mr-1 text-[15px] text-muted-foreground">(ברירת מחדל)</span>}
                  </Label>
                  <div className="flex overflow-hidden rounded-md border border-border text-xs">
                    {(["edit", "view", "none"] as PermissionLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => permissionsTarget && handleSetAreaLevel(permissionsTarget.user_id, key, lvl)}
                        className={cn(
                          "border-r border-border px-2.5 py-1.5 last:border-r-0",
                          level === lvl ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {PERMISSION_LEVEL_LABELS[lvl]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}
          <DialogFooter>
            <Button onClick={() => setPermissionsOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* הרשאות ברירת מחדל לפי תפקיד */}
      <Dialog open={roleDefaultsOpen} onOpenChange={setRoleDefaultsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הרשאות ברירת מחדל לפי תפקיד</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            חלות אוטומטית על כל חבר צוות מהתפקיד הזה שאין לו הרשאה נקודתית משלו — כולל עובדים שיצטרפו בעתיד.
          </p>
          <div className="grid gap-1.5">
            <Label>תפקיד</Label>
            <Select value={roleDefaultsRole} onValueChange={(v) => v && setRoleDefaultsRole(v as OrgRole)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => ROLE_LABELS[v as OrgRole]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as OrgRole[])
                  .filter((r) => r !== "admin")
                  .map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2.5">
            {PERMISSION_AREAS.map(({ key, label }) => {
              const level = orgDoc?.roleDefaultPermissions?.[roleDefaultsRole]?.[key] ?? "none";
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <Label className="text-sm">{label}</Label>
                  <div className="flex overflow-hidden rounded-md border border-border text-xs">
                    {(["edit", "view", "none"] as PermissionLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setOrgRoleDefaultPermission(roleDefaultsRole, key, lvl)}
                        className={cn(
                          "border-r border-border px-2.5 py-1.5 last:border-r-0",
                          level === lvl ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {PERMISSION_LEVEL_LABELS[lvl]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setRoleDefaultsOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>הסרת חבר צוות</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            להסיר את {removeTarget?.full_name} מהצוות? החשבון שלו יימחק לגמרי מהמערכת — הפעולה אינה
            הפיכה.
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={removing} onClick={() => setRemoveTarget(null)}>
              ביטול
            </Button>
            <Button variant="destructive" disabled={removing} onClick={handleRemove}>
              {removing ? "מסיר..." : "הסר"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
