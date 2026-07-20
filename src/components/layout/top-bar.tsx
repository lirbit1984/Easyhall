"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { GlobalSearch } from "@/components/layout/global-search";

export function TopBar() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2">
        {/* המבורגר — מובייל/טאבלט בלבד; בדסקטופ הסיידבר קבוע */}
        <Button
          variant="outline"
          size="icon"
          aria-label="פתח תפריט ניווט"
          className="lg:hidden"
          onClick={() => setNavOpen(true)}
        >
          <Menu className="size-4" />
        </Button>
        <GlobalSearch />
      </div>
      <UserMenu />

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="right"
          className="w-[240px] bg-sidebar py-[22px] text-sidebar-foreground"
          showCloseButton={false}
        >
          <SidebarContent onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
