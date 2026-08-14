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
  LifeBuoy,
} from "lucide-react";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { useOrg } from "@/lib/firebase/org-context";
import { useLeadsStore } from "@/store/use-leads-store";
import { RepAvatar } from "@/components/leads/rep-avatar";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/firebase/types";
import type { OrgRole } from "@/lib/firebase/types";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; hideFor?: OrgRole[] }[] = [
  { href: "/dashboard", label: "דשבורד", icon: LayoutDashboard, hideFor: ["accounting"] },
  { href: "/kanban", label: "כרטיסי אירוע", icon: LayoutGrid, hideFor: ["accounting"] },
  { href: "/calendar", label: "יומן", icon: CalendarDays, hideFor: ["accounting"] },
  { href: "/billing", label: "כספים ודוחות", icon: BarChart3, hideFor: ["office", "event_manager"] },
  { href: "/settings", label: "הגדרות", icon: Settings, hideFor: ["office", "sales_rep", "event_manager", "accounting"] },
];

/** מסך ניהול פניות תמיכה — קישור מוצג רק לבעל המערכת, לא לחברי צוות אולם. */
const PLATFORM_ADMIN_EMAIL = "peanuts.rlz@gmail.com";

/**
 * תוכן הניווט המלא (לוגו, קישורים, משתמש) — משותף לסיידבר הקבוע בדסקטופ
 * ולמגירת הניווט במובייל. onNavigate נקרא בלחיצה על קישור (לסגירת המגירה).
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useCurrentRole();
  const { user } = useOrg();
  const { members } = useOrgMembers();
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const currentUserName = useLeadsStore((s) => s.currentUserName);
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.hideFor?.includes(role));
  if (user?.email === PLATFORM_ADMIN_EMAIL) {
    visibleNavItems.push({ href: "/support", label: "תמיכה", icon: LifeBuoy });
  }
  const currentMember = members.find((m) => m.user_id === currentUserId);

  return (
    <>
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
              onClick={onNavigate}
              className={cn(
                "border-e-[3px] border-transparent px-5 py-[11px] text-[18.75px] tracking-[.08em] text-white/55 no-underline",
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

      <div className="mt-auto flex items-center gap-2.5 px-5 text-[17.25px] text-white/55">
        <RepAvatar userId={currentUserId} size="sm" />
        <span>
          <b className="block text-[18.75px] font-medium text-white">{currentUserName}</b>
          {currentMember?.role === "admin" ? "מנהל אולם" : currentMember ? ROLE_LABELS[currentMember.role] : ""}
        </span>
      </div>
    </>
  );
}

/** הסיידבר הקבוע — דסקטופ בלבד; במובייל הניווט נפתח כמגירה מהטופ-בר. */
export function Sidebar() {
  return (
    <aside className="hidden w-[210px] shrink-0 flex-col bg-sidebar py-[22px] text-sidebar-foreground lg:flex">
      <SidebarContent />
    </aside>
  );
}
