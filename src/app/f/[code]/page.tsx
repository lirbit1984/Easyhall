"use client";

import { use, useEffect, useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";
import { resolveShortLink } from "@/lib/short-link";

/**
 * דף גישור ציבורי לקישורים קצרים (/f/{code}) — מיועד לזוגות שמקבלים מסמך
 * בוואטסאפ/מייל, ולכן לא דורש התחברות. מתרגם את הקוד לכתובת ההורדה האמיתית
 * ומעביר אליה מיד.
 */
export default function ShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveShortLink(code)
      .then((link) => {
        if (cancelled) return;
        if (link) window.location.replace(link.url);
        else setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <main className="flex flex-1 items-center justify-center p-6 text-center">
      {notFound ? (
        <div className="grid justify-items-center gap-2">
          <FileWarning className="size-8 text-muted-foreground" />
          <h1 className="text-lg">הקישור לא נמצא</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            ייתכן שהקישור שגוי או שהמסמך הוסר. אפשר לבקש קישור חדש מהאולם.
          </p>
        </div>
      ) : (
        <div className="grid justify-items-center gap-2">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">פותח את המסמך...</p>
        </div>
      )}
    </main>
  );
}
