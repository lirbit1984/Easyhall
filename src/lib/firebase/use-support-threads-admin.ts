"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./client";
import type { SupportThreadSummary } from "./types";

/**
 * מנוי חי על תקציר כל שיחות התמיכה מכל הארגונים — למסך הניהול של לירן
 * בלבד. מסתמך על supportThreads/{orgId} שנכתב ע"י ה-Cloud Function.
 */
export function useSupportThreadsAdmin() {
  const [threads, setThreads] = useState<SupportThreadSummary[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    const q = query(collection(db, "supportThreads"), orderBy("lastMessageAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setThreads(snap.docs.map((d) => d.data() as SupportThreadSummary));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  return { threads, loading };
}
