"use client";

import { useMemo, useState } from "react";
import { Check, FolderOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLeadsStore } from "@/store/use-leads-store";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrgFile } from "@/lib/types";

/**
 * בחירת קובץ ממאגר הקבצים הארגוני (הגדרות > מאגר קבצים) וצירופו לכרטיס הליד.
 * הקובץ עצמו לא מועתק — נשמרת הפניה לאותה כתובת ב-Storage, כך שהחלפת הקובץ
 * במאגר (למשל תעודת כשרות מחודשת) משתקפת בכל הלידים שצורף אליהם.
 */
export function PickOrgFileDialog({
  open,
  onOpenChange,
  onPick,
  attachedUrls,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (file: OrgFile) => void;
  attachedUrls: string[];
}) {
  const orgFiles = useLeadsStore((s) => s.orgFiles);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(
    () => Array.from(new Set(orgFiles.map((f) => f.tag).filter((t): t is string => !!t))).sort(),
    [orgFiles]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orgFiles.filter((f) => {
      if (activeTag && f.tag !== activeTag) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || (f.tag ?? "").toLowerCase().includes(q);
    });
  }, [orgFiles, query, activeTag]);

  const handlePick = (file: OrgFile) => {
    onPick(file);
    onOpenChange(false);
    setQuery("");
    setActiveTag(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3 sm:max-w-md">
        <DialogHeader className="pe-8">
          <DialogTitle>בחירה ממאגר הקבצים</DialogTitle>
          <DialogDescription>
            הקובץ יצורף לכרטיס האירוע ויהיה זמין לשיתוף עם הזוג.
          </DialogDescription>
        </DialogHeader>

        {orgFiles.length === 0 ? (
          <div className="grid justify-items-center gap-2 py-8 text-center">
            <FolderOpen className="size-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              המאגר ריק. אפשר להעלות קבצים בהגדרות {"<"} מאגר קבצים.
            </p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חפש לפי שם או תיוג..."
                className="ps-8"
              />
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag((t) => (t === tag ? null : tag))}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                      activeTag === tag
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">לא נמצאו קבצים מתאימים.</p>
              )}
              {filtered.map((f) => {
                const attached = attachedUrls.includes(f.url);
                return (
                  <button
                    key={f.file_id}
                    type="button"
                    disabled={attached}
                    onClick={() => handlePick(f)}
                    className="flex w-full items-center gap-2 border-t border-border py-2 text-right text-sm first:border-t-0 disabled:opacity-50 enabled:hover:opacity-70"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{f.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        הועלה {formatDateTime(f.uploaded_at)}
                      </span>
                    </span>
                    {f.tag && (
                      <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                        {f.tag}
                      </Badge>
                    )}
                    {attached && <Check className="size-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <Button variant="outline" onClick={() => onOpenChange(false)}>
          סגור
        </Button>
      </DialogContent>
    </Dialog>
  );
}
