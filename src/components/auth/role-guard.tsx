"use client";

import { ShieldAlert } from "lucide-react";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import type { OrgRole } from "@/lib/firebase/types";

export function RoleGuard({
  allow,
  children,
}: {
  allow: OrgRole[];
  children: React.ReactNode;
}) {
  const role = useCurrentRole();

  if (!allow.includes(role)) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
        <ShieldAlert className="size-8" />
        <p className="text-sm">אין לך הרשאה לצפות במסך זה.</p>
      </div>
    );
  }

  return <>{children}</>;
}
