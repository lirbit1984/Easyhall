"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LayoutGrid,
  CalendarDays,
  BarChart3,
  Settings,
} from "lucide-react";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { useLeadsStore } from "@/store/use-leads-store";
import { RepAvatar } from "@/components/leads/rep-avatar";
import { cn } from "@/lib/utils";
import type { OrgRole } from "@/lib/firebase/types";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; hideFor?: OrgRole[] }[] = [
  { href: "/dashboard", label: "דשבורד", icon: LayoutDashboard },
  { href: "/kanban", label: "כרטיסי אירוע", icon: LayoutGrid },
  { href: "/calendar", label: "יומן", icon: CalendarDays },
  { href: "/billing", label: "כספים ודוחות", icon: BarChart3, hideFor: ["office"] },
  { href: "/settings", label: "הגדרות", icon: Settings, hideFor: ["office", "sales_rep"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const role = useCurrentRole();
  const { members } = useOrgMembers();
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const currentUserName = useLeadsStore((s) => s.currentUserName);
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.hideFor?.includes(role));
  const currentMember = members.find((m) => m.user_id === currentUserId);

  return (
    <aside className="flex w-[210px] shrink-0 flex-col bg-sidebar py-[22px] text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 pb-6">
        <Image src="/logo.svg" alt="" width={36} height={24} className="text-white" />
        <span className="font-heading text-lg font-semibold tracking-[.04em]">EasyHall</span>
      </div>

      <nav className="flex flex-col">
        {visibleNavItems.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "border-e-[3px] border-transparent px-5 py-[11px] text-[12.5px] tracking-[.08em] text-white/55 no-underline",
                active
                  ? "border-white bg-white/8 text-white"
                  : "hover:bg-white/5 hover:text-white/80"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 px-5 text-[11.5px] text-white/55">
        <RepAvatar userId={currentUserId} size="sm" />
        <span>
          <b className="block text-[12.5px] font-medium text-white">{currentUserName}</b>
          {currentMember?.role === "office"
            ? "משרד"
            : currentMember?.role === "sales_rep"
              ? "נציג מכירות"
              : "מנהל אולם"}
        </span>
      </div>
    </aside>
  );
}
