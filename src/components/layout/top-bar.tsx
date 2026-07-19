"use client";

import { UserMenu } from "@/components/layout/user-menu";

export function TopBar() {
  return (
    <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
      <UserMenu />
    </div>
  );
}
