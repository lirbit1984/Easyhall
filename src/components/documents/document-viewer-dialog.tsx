"use client";

import { Download, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** צופה PDF בתוך האפליקציה (iframe), במקום לפתוח לשונית Chrome נפרדת. */
export function DocumentViewerDialog({
  doc,
  onOpenChange,
}: {
  doc: { name: string; url: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-2">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pe-8">
          <DialogTitle className="truncate">{doc?.name}</DialogTitle>
          {doc && (
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => window.open(doc.url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="size-3.5" />
                פתח בלשונית
              </Button>
              <a
                href={doc.url}
                download={doc.name}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
              >
                <Download className="size-3.5" />
                הורד
              </a>
            </div>
          )}
        </DialogHeader>
        {doc && <iframe src={doc.url} className="min-h-0 flex-1 rounded-md border border-border" title={doc.name} />}
      </DialogContent>
    </Dialog>
  );
}
