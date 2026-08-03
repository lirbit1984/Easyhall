"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, Folder, FolderOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { useLeadsStore } from "@/store/use-leads-store";
import { formatDateTime, primaryPhone, primaryContactName, waLink } from "@/lib/format";
import { openBlankTab, navigateTab } from "@/lib/open-tab";
import { cn } from "@/lib/utils";
import type { EventContact, OrgFile } from "@/lib/types";

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
  contacts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (file: OrgFile) => void;
  attachedUrls: string[];
  contacts?: EventContact[];
}) {
  const orgFiles = useLeadsStore((s) => s.orgFiles);
  const orgFileFolders = useLeadsStore((s) => s.orgFileFolders);
  const [query, setQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const breadcrumb = useMemo(() => {
    const chain: typeof orgFileFolders = [];
    let id = currentFolderId;
    while (id) {
      const f = orgFileFolders.find((f) => f.folder_id === id);
      if (!f) break;
      chain.unshift(f);
      id = f.parent_folder_id ?? null;
    }
    return chain;
  }, [orgFileFolders, currentFolderId]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const subfolders = searching ? [] : orgFileFolders.filter((f) => (f.parent_folder_id ?? null) === currentFolderId);

  const filtered = useMemo(() => {
    if (searching) {
      return orgFiles.filter((f) => f.name.toLowerCase().includes(q) || (f.tag ?? "").toLowerCase().includes(q));
    }
    return orgFiles.filter((f) => (f.folder_id ?? null) === currentFolderId);
  }, [orgFiles, searching, q, currentFolderId]);

  const handlePick = (file: OrgFile) => {
    onPick(file);
    onOpenChange(false);
    setQuery("");
    setCurrentFolderId(null);
    setSelected([]);
  };

  const toggleSelected = (fileId: string) => {
    setSelected((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]));
  };

  const attachSelected = () => {
    const files = orgFiles.filter((f) => selected.includes(f.file_id) && !attachedUrls.includes(f.url));
    files.forEach((f) => onPick(f));
    onOpenChange(false);
    setSelected([]);
  };

  const sendSelectedWhatsApp = () => {
    const files = orgFiles.filter((f) => selected.includes(f.file_id));
    if (files.length === 0) return;
    const win = openBlankTab();
    const contactName = contacts ? primaryContactName({ contacts }) : "";
    const intro = contactName ? `שלום ${contactName}, מצורפים הקבצים הבאים:` : "מצורפים הקבצים הבאים:";
    const message = `${intro}\n\n${files.map((f) => `${f.name}\n${f.url}`).join("\n\n")}`;
    const phone = contacts ? primaryPhone({ contacts }) : "";
    navigateTab(win, waLink(phone, message));
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

            {!searching && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(null)}
                  className={cn("hover:underline", currentFolderId === null && "font-medium text-foreground")}
                >
                  מאגר הקבצים
                </button>
                {breadcrumb.map((f) => (
                  <span key={f.folder_id} className="flex items-center gap-1">
                    <ChevronLeft className="size-3 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(f.folder_id)}
                      className={cn("hover:underline", f.folder_id === currentFolderId && "font-medium text-foreground")}
                    >
                      {f.name}
                    </button>
                  </span>
                ))}
              </div>
            )}

            {selected.length > 0 && (
              <div className="flex items-center gap-2 border border-dashed border-border p-2 text-xs">
                <span className="flex-1 text-muted-foreground">{selected.length} קבצים נבחרו</span>
                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={attachSelected}>
                  <Check className="size-3.5" />
                  צרף לכרטיס
                </Button>
                {contacts && (
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={sendSelectedWhatsApp}>
                    <WhatsappIcon className="size-3.5 text-green-600" />
                    שלח בוואטסאפ
                  </Button>
                )}
              </div>
            )}

            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {!searching &&
                subfolders.map((f) => {
                  const count = orgFiles.filter((of) => of.folder_id === f.folder_id).length;
                  return (
                    <button
                      key={f.folder_id}
                      type="button"
                      onClick={() => setCurrentFolderId(f.folder_id)}
                      className="flex w-full items-center gap-2 border-t border-border py-2 text-right text-sm first:border-t-0 hover:opacity-70"
                    >
                      <Folder className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">({count})</span>
                    </button>
                  );
                })}

              {filtered.length === 0 && subfolders.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {searching ? "לא נמצאו קבצים מתאימים." : "התיקייה ריקה."}
                </p>
              )}
              {filtered.map((f) => {
                const attached = attachedUrls.includes(f.url);
                return (
                  <div
                    key={f.file_id}
                    className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(f.file_id)}
                      onChange={() => toggleSelected(f.file_id)}
                      className="accent-primary"
                      aria-label="בחר קובץ"
                    />
                    <button
                      type="button"
                      disabled={attached}
                      onClick={() => handlePick(f)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-right disabled:opacity-50 enabled:hover:opacity-70"
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
                  </div>
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
