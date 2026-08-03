"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { ChevronLeft, Download, FolderOpen, FolderPlus, Folder, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { useLeadsStore } from "@/store/use-leads-store";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { formatDateTime, waLink } from "@/lib/format";
import { openBlankTab, navigateTab } from "@/lib/open-tab";
import { cn } from "@/lib/utils";

export function OrgFilesSettings() {
  const orgId = useLeadsStore((s) => s.orgId);
  const orgFiles = useLeadsStore((s) => s.orgFiles);
  const orgFileFolders = useLeadsStore((s) => s.orgFileFolders);
  const addOrgFile = useLeadsStore((s) => s.addOrgFile);
  const updateOrgFile = useLeadsStore((s) => s.updateOrgFile);
  const deleteOrgFile = useLeadsStore((s) => s.deleteOrgFile);
  const addOrgFileFolder = useLeadsStore((s) => s.addOrgFileFolder);
  const deleteOrgFileFolder = useLeadsStore((s) => s.deleteOrgFileFolder);

  const [tagDraft, setTagDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
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

  const subfolders = orgFileFolders.filter((f) => (f.parent_folder_id ?? null) === currentFolderId);
  const filesHere = orgFiles.filter((f) => (f.folder_id ?? null) === currentFolderId);

  const folderIsEmpty = (folderId: string) =>
    !orgFiles.some((f) => (f.folder_id ?? null) === folderId) &&
    !orgFileFolders.some((f) => (f.parent_folder_id ?? null) === folderId);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isFirebaseConfigured || !storage || !orgId) return;
    setUploading(true);
    try {
      const path = `organizations/${orgId}/files/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      addOrgFile({ name: file.name, url, tag: tagDraft.trim() || undefined, folder_id: currentFolderId });
      setTagDraft("");
      toast.success("הקובץ הועלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ");
    } finally {
      setUploading(false);
    }
  };

  const createFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("יש להזין שם לתיקייה");
      return;
    }
    addOrgFileFolder(newFolderName.trim(), currentFolderId);
    setNewFolderName("");
  };

  const removeFolder = (folderId: string) => {
    if (!folderIsEmpty(folderId)) {
      toast.error("אפשר למחוק רק תיקייה ריקה — יש להעביר או למחוק קודם את הקבצים והתיקיות שבתוכה");
      return;
    }
    deleteOrgFileFolder(folderId);
  };

  const toggleSelected = (fileId: string) => {
    setSelected((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]));
  };

  const sendWhatsApp = (files: typeof orgFiles) => {
    if (files.length === 0) return;
    const win = openBlankTab();
    const message = files.map((f) => `${f.name}\n${f.url}`).join("\n\n");
    navigateTab(win, waLink("", message));
  };

  return (
    <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <FolderOpen className="size-4 text-muted-foreground" />
        <h2 className="text-base">מאגר קבצים</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        קבצים כלליים של האולם שלא שייכים לליד ספציפי — תעודת כשרות, ביטוח, תמונות וכו&apos;. אפשר לארגן בתיקיות
        ולשלוח בוואטסאפ תיקייה שלמה או קבצים נבחרים.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => setCurrentFolderId(null)}
          className={cn("hover:underline", currentFolderId === null && "font-medium text-foreground")}
        >
          מאגר הקבצים
        </button>
        {breadcrumb.map((f) => (
          <span key={f.folder_id} className="flex items-center gap-1">
            <ChevronLeft className="size-3.5 text-muted-foreground" />
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

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="org_file_tag">תיוג (אופציונלי)</Label>
          <Input
            id="org_file_tag"
            placeholder="לדוגמה: תעודת כשרות"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            className="w-56"
          />
        </div>
        <label
          className={cn(
            buttonVariants({ variant: "outline" }),
            "cursor-pointer gap-1.5",
            uploading && "pointer-events-none opacity-50"
          )}
        >
          <input type="file" className="sr-only" disabled={uploading} onChange={handleUpload} />
          {uploading ? "מעלה..." : "העלה קובץ"}
        </label>
        <div className="flex items-end gap-1.5">
          <Input
            placeholder="שם תיקייה חדשה"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="h-9 w-40"
          />
          <Button variant="outline" className="h-9 gap-1.5" onClick={createFolder}>
            <FolderPlus className="size-4" />
            תיקייה
          </Button>
        </div>
      </div>

      {subfolders.length > 0 && (
        <div className="mb-3 grid gap-1.5">
          {subfolders.map((f) => {
            const filesInFolder = orgFiles.filter((of) => of.folder_id === f.folder_id);
            return (
              <div key={f.folder_id} className="flex items-center gap-2 border border-border px-2.5 py-2 text-sm">
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(f.folder_id)}
                  className="flex flex-1 items-center gap-2 text-right"
                >
                  <Folder className="size-4 text-muted-foreground" />
                  <span className="font-medium">{f.name}</span>
                  <span className="text-xs text-muted-foreground">({filesInFolder.length})</span>
                </button>
                {filesInFolder.length > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="שליחת התיקייה בוואטסאפ"
                    onClick={() => sendWhatsApp(filesInFolder)}
                  >
                    <WhatsappIcon className="size-3.5 text-green-600" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="size-7" onClick={() => removeFolder(f.folder_id)} aria-label="מחיקת תיקייה">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mb-2 flex items-center gap-2 border border-dashed border-border p-2 text-sm">
          <span className="flex-1 text-xs text-muted-foreground">{selected.length} קבצים נבחרו</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => sendWhatsApp(orgFiles.filter((f) => selected.includes(f.file_id)))}
          >
            <WhatsappIcon className="size-3.5 text-green-600" />
            שלח בוואטסאפ
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected([])}>
            נקה בחירה
          </Button>
        </div>
      )}

      <div className="grid gap-1.5">
        {filesHere.length === 0 && subfolders.length === 0 && (
          <p className="text-sm text-muted-foreground">התיקייה ריקה.</p>
        )}
        {filesHere.map((f) => (
          <div key={f.file_id} className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0">
            <input
              type="checkbox"
              checked={selected.includes(f.file_id)}
              onChange={() => toggleSelected(f.file_id)}
              className="accent-primary"
              aria-label="בחר קובץ"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{f.name}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                הועלה {formatDateTime(f.uploaded_at)}
              </span>
            </span>
            {f.tag && (
              <Badge variant="secondary" className="rounded-full text-[10px]">
                {f.tag}
              </Badge>
            )}
            {orgFileFolders.length > 0 && (
              <Select
                value={f.folder_id ?? "__root__"}
                onValueChange={(v) => v && updateOrgFile(f.file_id, { folder_id: v === "__root__" ? null : v })}
              >
                <SelectTrigger size="sm" className="w-32 text-xs">
                  <SelectValue>
                    {(v: string) => (v === "__root__" ? "מאגר הקבצים" : orgFileFolders.find((of) => of.folder_id === v)?.name ?? v)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">מאגר הקבצים</SelectItem>
                  {orgFileFolders.map((of) => (
                    <SelectItem key={of.folder_id} value={of.folder_id}>
                      {of.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <a
              href={f.url}
              download={f.name}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7")}
              aria-label="הורדה"
            >
              <Download className="size-3.5" />
            </a>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => deleteOrgFile(f.file_id)} aria-label="מחיקה">
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </BlueprintBox>
  );
}
