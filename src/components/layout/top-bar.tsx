"use client";

import { Search, ListFilter, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LEAD_SOURCES } from "@/lib/mock-data";
import { useFiltersStore } from "@/store/use-filters-store";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { search, setSearch, sourceFilter, setSourceFilter } = useFiltersStore();
  const sourceActive = sourceFilter !== "all";

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
      {/* Start (ימין): אייקון סינון מקור ליד */}
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

      {/* Center: חיפוש */}
      <div className="flex flex-1 justify-center">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש שם זוג / טלפון / תאריך..."
            className="pr-8"
          />
        </div>
      </div>

      {/* End (שמאל): תפריט משתמש (כפתור "ליד חדש" עבר לכפתור צף) */}
      <div className="flex shrink-0 items-center gap-2">
        <UserMenu />
      </div>
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
