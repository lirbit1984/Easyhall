"use client";

import { useSyncExternalStore } from "react";

export type BoardView = "kanban" | "table";

const STORAGE_KEY = "easyhall_board_view";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): BoardView {
  return localStorage.getItem(STORAGE_KEY) === "table" ? "table" : "kanban";
}

// בשרת אין localStorage — מחזירים את ברירת המחדל, ו-useSyncExternalStore
// מיישב את ההבדל מול הלקוח אחרי ה-hydration בלי אזהרה.
function getServerSnapshot(): BoardView {
  return "kanban";
}

/**
 * מצב התצוגה של הדשבורד (קנבאן / טבלה), נשמר בדפדפן כך שהבחירה נזכרת בין
 * כניסות ומסונכרנת בין טאבים פתוחים. ברירת המחדל היא קנבאן.
 */
export function useBoardView() {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = (next: BoardView) => {
    localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((l) => l());
  };

  return { view, setView };
}
