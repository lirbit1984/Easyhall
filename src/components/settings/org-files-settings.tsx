"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { ChevronLeft, Download, FolderOpen, FolderPlus, Folder, Pencil, Sparkles, Trash2, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { useLeadsStore } from "@/store/use-leads-store";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { formatDateTime, waLink } from "@/lib/format";
import { openBlankTab, navigateTab } from "@/lib/open-tab";
import type { OrgFile } from "@/lib/types";
import { cn } from "@/lib/utils";

const RECOMMENDED_ROOT_FOLDERS = ["ביטוח", "רישיון עסק", "כשרות", "בטיחות וכיבוי אש", "חוזי ספקים", "שיווק ותדמית"];

export function OrgFilesSettings() {
  const orgId = useLeadsStore((s) => s.orgId);
  const orgFiles = useLeadsStore((s) => s.orgFiles);
  const orgFileFolders = useLeadsStore((s) => s.orgFileFolders);
  const addOrgFile = useLeadsStore((s) => s.addOrgFile);
  const updateOrgFile = useLeadsStore((s) => s.updateOrgFile);
  const deleteOrgFile = useLeadsStore((s) => s.deleteOrgFile);
  const addOrgFileFolder = useLeadsStore((s) => s.addOrgFileFolder);
  const updateOrgFileFolder = useLeadsStore((s) => s.updateOrgFileFolder);
  const deleteOrgFileFolder = useLeadsStore((s) => s.deleteOrgFileFolder);

  const [uploading, setUploading] = useState(false);
  const [pendingTagFile, setPendingTagFile] = useState<OrgFile | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [drawerFolderId, setDrawerFolderId] = useState<string | null>(null);
  const [addSubfolderOpen, setAddSubfolderOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderDraft, setRenameFolderDraft] = useState("");

  const [selected, setSelected] = useState<string[]>([]);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const rootFolders = orgFileFolders.filter((f) => !f.parent_folder_id);
  const rootFolderNames = rootFolders.map((f) => f.name);
  const missingRecommendedFolders = RECOMMENDED_ROOT_FOLDERS.filter((name) => !rootFolderNames.includes(name));
  const drawerFolder = orgFileFolders.find((f) => f.folder_id === drawerFolderId) ?? null;
  const drawerSubfolders = orgFileFolders.filter((f) => f.parent_folder_id === drawerFolderId);
  const drawerFiles = orgFiles.filter((f) => (f.folder_id ?? null) === drawerFolderId);

  const folderIsEmpty = (folderId: string) =>
    !orgFiles.some((f) => (f.folder_id ?? null) === folderId) &&
    !orgFileFolders.some((f) => (f.parent_folder_id ?? null) === folderId);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetFolderId: string | null) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isFirebaseConfigured || !storage || !orgId) return;
    setUploading(true);
    try {
      const path = `organizations/${orgId}/files/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      const newFile = addOrgFile({ name: file.name, url, folder_id: targetFolderId });
      setPendingTagFile(newFile);
      setTagDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ");
    } finally {
      setUploading(false);
    }
  };

  const saveTagAndClose = () => {
    if (pendingTagFile && tagDraft.trim()) {
      updateOrgFile(pendingTagFile.file_id, { tag: tagDraft.trim() });
    }
    setPendingTagFile(null);
    setTagDraft("");
  };

  const createRootFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("יש להזין שם לתיקייה");
      return;
    }
    addOrgFileFolder(newFolderName.trim(), null);
    setNewFolderName("");
    setAddFolderOpen(false);
  };

  const createSubfolder = () => {
    if (!newSubfolderName.trim() || !drawerFolderId) return;
    addOrgFileFolder(newSubfolderName.trim(), drawerFolderId);
    setNewSubfolderName("");
    setAddSubfolderOpen(false);
  };

  const createRecommendedFolders = () => {
    missingRecommendedFolders.forEach((name) => addOrgFileFolder(name, null));
    toast.success("התיקיות המומלצות נוצרו");
  };

  const removeFolder = (folderId: string) => {
    if (!folderIsEmpty(folderId)) {
      toast.error("אפשר למחוק רק תיקייה ריקה — יש להעביר או למחוק קודם את הקבצים והתיקיות שבתוכה");
      return;
    }
    deleteOrgFileFolder(folderId);
    if (drawerFolderId === folderId) setDrawerFolderId(null);
  };

  const startRenameFolder = (folderId: string, name: string) => {
    setRenamingFolderId(folderId);
    setRenameFolderDraft(name);
  };

  const saveRenameFolder = () => {
    if (!renamingFolderId) return;
    const name = renameFolderDraft.trim();
    if (name) updateOrgFileFolder(renamingFolderId, { name });
    setRenamingFolderId(null);
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

  const startRename = (fileId: string, name: string) => {
    setRenamingFileId(fileId);
    setRenameDraft(name);
  };

  const saveRename = () => {
    if (!renamingFileId) return;
    const name = renameDraft.trim();
    if (name) updateOrgFile(renamingFileId, { name });
    setRenamingFileId(null);
  };

  const renderFileRow = (f: OrgFile, showFolderBadge: boolean) => (
    <div key={f.file_id} className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0">
      <input
        type="checkbox"
        checked={selected.includes(f.file_id)}
        onChange={() => toggleSelected(f.file_id)}
        className="accent-primary"
        aria-label="בחר קובץ"
      />
      {renamingFileId === f.file_id ? (
        <Input
          autoFocus
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") setRenamingFileId(null);
          }}
          className="h-7 flex-1 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => startRename(f.file_id, f.name)}
          className="min-w-0 flex-1 text-right hover:underline"
          title="לחיצה לשינוי שם"
        >
          <span className="block truncate">{f.name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">הועלה {formatDateTime(f.uploaded_at)}</span>
        </button>
      )}
      {f.tag && (
        <Badge variant="secondary" className="rounded-full text-[10px]">
          {f.tag}
        </Badge>
      )}
      {showFolderBadge && (
        <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
          {f.folder_id ? orgFileFolders.find((of) => of.folder_id === f.folder_id)?.name ?? "תיקייה" : "מאגר הקבצים"}
        </Badge>
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
  );

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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label
          className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer gap-1.5", uploading && "pointer-events-none opacity-50")}
        >
          <Upload className="size-4" />
          <input type="file" className="sr-only" disabled={uploading} onChange={(e) => handleUpload(e, null)} />
          {uploading ? "מעלה..." : "העלה קובץ"}
        </label>

        <Popover open={addFolderOpen} onOpenChange={setAddFolderOpen}>
          <PopoverTrigger render={<Button variant="outline" className="gap-1.5" />}>
            <FolderPlus className="size-4" />
            הוסף תיקייה
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="grid gap-2">
              <Label htmlFor="new_root_folder_name">שם התיקייה</Label>
              <Input
                id="new_root_folder_name"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createRootFolder()}
              />
              <Button size="sm" className="w-fit" onClick={createRootFolder}>
                יצירה
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {missingRecommendedFolders.length > 0 && (
          <Button type="button" size="sm" variant="ghost" className="h-9 gap-1.5 text-xs" onClick={createRecommendedFolders}>
            <Sparkles className="size-3.5" />
            צור תיקיות מומלצות ({missingRecommendedFolders.length})
          </Button>
        )}
      </div>

      {pendingTagFile && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 p-2.5 text-sm">
          <span className="text-xs text-muted-foreground">תיוג &quot;{pendingTagFile.name}&quot;:</span>
          <Input
            autoFocus
            placeholder="לדוגמה: תעודת כשרות"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveTagAndClose()}
            className="h-8 max-w-56"
          />
          <Button size="sm" className="h-8" onClick={saveTagAndClose}>
            שמירה
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setPendingTagFile(null)}>
            דלג
          </Button>
        </div>
      )}

      <Tabs defaultValue="folders" className="gap-3">
        <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
          <TabsTrigger value="folders" className="flex-none px-4 py-2">תיקיות</TabsTrigger>
          <TabsTrigger value="files" className="flex-none px-4 py-2">קבצים ({orgFiles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="folders">
          {rootFolders.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין תיקיות.</p>}
          <div className="grid gap-1.5">
            {rootFolders.map((f) => {
              const filesInFolder = orgFiles.filter((of) => of.folder_id === f.folder_id);
              return (
                <div key={f.folder_id} className="flex items-center gap-2 border border-border px-2.5 py-2 text-sm">
                  {renamingFolderId === f.folder_id ? (
                    <Input
                      autoFocus
                      value={renameFolderDraft}
                      onChange={(e) => setRenameFolderDraft(e.target.value)}
                      onBlur={saveRenameFolder}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRenameFolder();
                        if (e.key === "Escape") setRenamingFolderId(null);
                      }}
                      className="h-7 flex-1"
                    />
                  ) : (
                    <button type="button" onClick={() => setDrawerFolderId(f.folder_id)} className="flex flex-1 items-center gap-2 text-right">
                      <Folder className="size-4 text-muted-foreground" />
                      <span className="font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground">({filesInFolder.length})</span>
                    </button>
                  )}
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
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => startRenameFolder(f.folder_id, f.name)} aria-label="שינוי שם תיקייה">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => removeFolder(f.folder_id)} aria-label="מחיקת תיקייה">
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="files">
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
          {orgFiles.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין קבצים.</p>}
          <div className="grid gap-1.5">{orgFiles.map((f) => renderFileRow(f, true))}</div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!drawerFolderId} onOpenChange={(open) => !open && setDrawerFolderId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border pb-3">
            {renamingFolderId === drawerFolder?.folder_id ? (
              <Input
                autoFocus
                value={renameFolderDraft}
                onChange={(e) => setRenameFolderDraft(e.target.value)}
                onBlur={saveRenameFolder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRenameFolder();
                  if (e.key === "Escape") setRenamingFolderId(null);
                }}
                className="h-8 max-w-xs"
              />
            ) : (
              <SheetTitle className="flex items-center gap-2">
                <Folder className="size-4 text-muted-foreground" />
                {drawerFolder?.name}
                {drawerFolder && (
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => startRenameFolder(drawerFolder.folder_id, drawerFolder.name)} aria-label="שינוי שם">
                    <Pencil className="size-3.5" />
                  </Button>
                )}
              </SheetTitle>
            )}
            <SheetDescription className="sr-only">קבצים ותתי-תיקיות בתוך {drawerFolder?.name}</SheetDescription>
          </SheetHeader>

          {drawerFolderId && (
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer gap-1.5", uploading && "pointer-events-none opacity-50")}
                >
                  <Upload className="size-3.5" />
                  <input type="file" className="sr-only" disabled={uploading} onChange={(e) => handleUpload(e, drawerFolderId)} />
                  {uploading ? "מעלה..." : "העלה קובץ"}
                </label>
                <Popover open={addSubfolderOpen} onOpenChange={setAddSubfolderOpen}>
                  <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
                    <FolderPlus className="size-3.5" />
                    הוסף תיקייה
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="grid gap-2">
                      <Label htmlFor="new_subfolder_name">שם התיקייה</Label>
                      <Input
                        id="new_subfolder_name"
                        autoFocus
                        value={newSubfolderName}
                        onChange={(e) => setNewSubfolderName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createSubfolder()}
                      />
                      <Button size="sm" className="w-fit" onClick={createSubfolder}>
                        יצירה
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {drawerSubfolders.length > 0 && (
                <div className="grid gap-1.5">
                  {drawerSubfolders.map((sf) => {
                    const filesInSubfolder = orgFiles.filter((of) => of.folder_id === sf.folder_id);
                    return (
                      <button
                        key={sf.folder_id}
                        type="button"
                        onClick={() => setDrawerFolderId(sf.folder_id)}
                        className="flex items-center gap-2 border border-border px-2.5 py-2 text-sm text-right"
                      >
                        <Folder className="size-4 text-muted-foreground" />
                        <span className="flex-1 font-medium">{sf.name}</span>
                        <span className="text-xs text-muted-foreground">({filesInSubfolder.length})</span>
                        <ChevronLeft className="size-3.5 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid gap-1.5">
                {drawerFiles.length === 0 && <p className="text-sm text-muted-foreground">אין קבצים בתיקייה זו.</p>}
                {drawerFiles.map((f) => renderFileRow(f, false))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </BlueprintBox>
  );
}
