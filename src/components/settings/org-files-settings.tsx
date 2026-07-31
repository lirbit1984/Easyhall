"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Download, FolderOpen, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OrgFilesSettings() {
  const orgId = useLeadsStore((s) => s.orgId);
  const orgFiles = useLeadsStore((s) => s.orgFiles);
  const addOrgFile = useLeadsStore((s) => s.addOrgFile);
  const deleteOrgFile = useLeadsStore((s) => s.deleteOrgFile);

  const [tagDraft, setTagDraft] = useState("");
  const [uploading, setUploading] = useState(false);

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
      addOrgFile({ name: file.name, url, tag: tagDraft.trim() || undefined });
      setTagDraft("");
      toast.success("הקובץ הועלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <FolderOpen className="size-4 text-muted-foreground" />
        <h2 className="text-base">מאגר קבצים</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        קבצים כלליים של האולם שלא שייכים לליד ספציפי — תעודת כשרות, ביטוח, תמונות וכו&apos;.
      </p>

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
      </div>

      <div className="grid gap-1.5">
        {orgFiles.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין קבצים.</p>}
        {orgFiles.map((f) => (
          <div key={f.file_id} className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0">
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
