"use client";

import { Plus } from "lucide-react";

/**
 * כפתור פעולה צף (FAB) ליצירת ליד חדש. יושב קבוע בפינה ימין-למטה, נגיש
 * מכל מסך באפליקציה. פותח את NewLeadDialog שמנוהל ב-AppShell.
 */
export function NewLeadFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="ליד חדש"
      className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
    >
      <Plus className="size-6" />
    </button>
  );
}
