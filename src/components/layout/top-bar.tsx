"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Plus,
  KanbanSquare,
  Table2,
  CalendarDays,
  ListChecks,
  BarChart3,
  Users,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES } from "@/lib/mock-data";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { useFiltersStore } from "@/store/use-filters-store";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import type { OrgRole } from "@/lib/firebase/types";

const NAV_ITEMS: { href: string; label: string; icon: typeof KanbanSquare; hideFor?: OrgRole[] }[] = [
  { href: "/kanban", label: "קנבאן", icon: KanbanSquare },
  { href: "/table", label: "טבלה", icon: Table2 },
  { href: "/calendar", label: "יומן", icon: CalendarDays },
  { href: "/tasks", label: "מטלות", icon: ListChecks },
  { href: "/bi", label: "דוחות", icon: BarChart3, hideFor: ["office"] },
  { href: "/team", label: "צוות", icon: Users },
  { href: "/settings", label: "הגדרות", icon: Settings, hideFor: ["office", "sales_rep"] },
];

export function TopBar({ onNewLead }: { onNewLead?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { search, setSearch, repFilter, setRepFilter, sourceFilter, setSourceFilter } =
    useFiltersStore();
  const { members } = useOrgMembers();
  const role = useCurrentRole();
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.hideFor?.includes(role));

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:gap-3">
        {/* Row 1 (mobile): logo + new-lead. Same row as everything else on lg+ */}
        <div className="flex items-center justify-between gap-2 lg:justify-start lg:gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground sm:size-9 sm:text-sm">
              EH
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold">EasyHall CRM</span>
              <span className="text-xs text-muted-foreground">ניהול מכירות ולידים</span>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <Button onClick={onNewLead} size="sm" className="gap-1.5 shrink-0">
              <Plus className="size-4" />
              ליד חדש
            </Button>
            <UserMenu />
          </div>
        </div>

        {/* Row 2 (mobile): scrollable view nav */}
        <nav className="flex items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1 lg:order-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = pathname?.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Row 3 (mobile): search + filters */}
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:order-1 lg:max-w-xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש שם זוג / טלפון / תאריך..."
              className="pr-8"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={repFilter} onValueChange={(v) => setRepFilter(v ?? "all")}>
              <SelectTrigger className="w-full shrink-0 sm:w-[130px]">
                <SelectValue placeholder="נציג">
                  {(value: string) =>
                    value === "all"
                      ? "כל הנציגים"
                      : members.find((u) => u.user_id === value)?.full_name
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הנציגים</SelectItem>
                {members.filter((u) => u.role !== "office").map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v ?? "all")}>
              <SelectTrigger className="hidden w-[140px] shrink-0 md:flex">
                <SelectValue placeholder="מקור ליד">
                  {(value: string) => (value === "all" ? "כל המקורות" : value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המקורות</SelectItem>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:order-3 lg:flex">
          <Button onClick={onNewLead} size="sm" className="gap-1.5 shrink-0">
            <Plus className="size-4" />
            ליד חדש
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
