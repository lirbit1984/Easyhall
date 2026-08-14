"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ListFilter, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { LeadCard } from "@/components/kanban/lead-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLeadsStore } from "@/store/use-leads-store";
import { useFiltersStore } from "@/store/use-filters-store";
import { LEAD_SOURCES } from "@/lib/mock-data";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | LeadStatus | "reserved";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "potential", label: "פוטנציאלי" },
  { key: "reserved", label: "משוריין" },
  { key: "closed", label: "סגור" },
  { key: "not_relevant", label: "לא רלוונטי" },
];

/**
 * מסך כרטיסי אירוע: כל הזוגות שנפתחו אי-פעם, עם סינון לפי סטטוס. "משוריין"
 * אינו LeadStatus נפרד — הוא נגזר מקיום אירוע option_hold ביומן האולם.
 */
export function LeadCardsView() {
  const leads = useLeadsStore((s) => s.leads);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);
  const { search, setSearch, repFilter, sourceFilter, setSourceFilter } = useFiltersStore();
  const sourceActive = sourceFilter !== "all";

  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initialFilter === "open" ? "potential" : "all"
  );
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const reservedLeadIds = useMemo(
    () => new Set(calendarEvents.filter((e) => e.event_type === "option_hold").map((e) => e.lead_id)),
    [calendarEvents]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter === "reserved" && !reservedLeadIds.has(l.lead_id)) return false;
      if (statusFilter !== "all" && statusFilter !== "reserved" && l.status !== statusFilter)
        return false;
      if (repFilter !== "all" && l.assigned_user_id !== repFilter) return false;
      if (sourceFilter !== "all" && l.lead_source !== sourceFilter) return false;
      if (q) {
        const haystack = (l.contacts ?? []).map((c) => `${c.name} ${c.phone ?? ""}`).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [leads, statusFilter, reservedLeadIds, repFilter, sourceFilter, search]);

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title="כרטיסי אירוע" subtitle="כל הזוגות שנפתחו — סינון לפי סטטוס" />

      <div className="mb-3.5 flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="סינון לפי מקור ליד"
                className="relative shrink-0"
              />
            }
          >
            <ListFilter className="size-4" />
            {sourceActive && (
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background" />
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 gap-0.5 p-1.5">
            <SourceOption
              label="כל המקורות"
              selected={sourceFilter === "all"}
              onClick={() => setSourceFilter("all")}
            />
            <div className="my-1 h-px bg-border" />
            {LEAD_SOURCES.map((s) => (
              <SourceOption
                key={s}
                label={s}
                selected={sourceFilter === s}
                onClick={() => setSourceFilter(s)}
              />
            ))}
          </PopoverContent>
        </Popover>

        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש שם זוג / טלפון..."
            className="pr-8"
          />
        </div>
      </div>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[15.6px] transition-colors",
              statusFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((l) => (
          <LeadCard key={l.lead_id} lead={l} onOpen={setOpenLeadId} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            לא נמצאו לידים תואמים.
          </p>
        )}
      </div>

      <LeadDrawer leadId={openLeadId} onOpenChange={(open) => !open && setOpenLeadId(null)} />
    </div>
  );
}

function SourceOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-right text-sm transition-colors hover:bg-muted",
        selected && "font-medium text-foreground"
      )}
    >
      {label}
      {selected && <Check className="size-4 text-primary" />}
    </button>
  );
}
