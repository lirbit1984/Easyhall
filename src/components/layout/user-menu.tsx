"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { LogOut, Building2, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";
import { RepAvatar } from "@/components/leads/rep-avatar";
import { useLeadsStore } from "@/store/use-leads-store";

export function UserMenu() {
  const router = useRouter();
  const { memberships, currentOrgId, setCurrentOrgId } = useOrg();
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const currentUserName = useLeadsStore((s) => s.currentUserName);

  if (!isFirebaseConfigured) return null;

  const org = memberships.find((m) => m.orgId === currentOrgId);

  const handleSignOut = async () => {
    await signOut(auth!);
    router.push("/login");
  };

  const handleSwitchOrg = (orgId: string) => {
    if (orgId === currentOrgId) return;
    setCurrentOrgId(orgId);
    router.push("/kanban");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted" />
        }
      >
        <RepAvatar userId={currentUserId} size="sm" />
        <span className="hidden text-sm font-medium sm:inline">{currentUserName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{currentUserName}</span>
              {org && (
                <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Building2 className="size-3" />
                  {org.orgName}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {memberships.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {memberships.map((m) => (
                <DropdownMenuItem
                  key={m.orgId}
                  onClick={() => handleSwitchOrg(m.orgId)}
                  className="gap-2"
                >
                  <Building2 className="size-3.5 text-muted-foreground" />
                  <span className="flex-1">{m.orgName}</span>
                  {m.orgId === currentOrgId && <Check className="size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive">
            <LogOut className="size-3.5" />
            התנתק
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
