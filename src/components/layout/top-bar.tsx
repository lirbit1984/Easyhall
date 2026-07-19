"use client";

import { UserMenu } from "@/components/layout/user-menu";
import { GlobalSearch } from "@/components/layout/global-search";

export function TopBar() {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
      <GlobalSearch />
      <UserMenu />
    </div>
  );
}
