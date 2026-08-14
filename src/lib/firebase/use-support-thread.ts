"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./client";
import type { SupportMessage } from "./types";

/** מנוי חי על הודעות צ'אט התמיכה של ארגון ספציפי, מסודר מהישנה לחדשה. */
export function useSupportMessages(orgId: string | null) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !orgId) {
      Promise.resolve().then(() => {
        setMessages([]);
        setLoading(false);
      });
      return;
    }
    Promise.resolve().then(() => setLoading(true));
    const q = query(collection(db, "supportThreads", orgId, "messages"), orderBy("created_at", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ ...d.data(), message_id: d.id }) as SupportMessage));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [orgId]);

  return { messages, loading };
}

export async function sendSupportMessage(params: {
  orgId: string;
  sender: "user" | "admin";
  senderName: string;
  senderUserId: string;
  text: string;
}) {
  if (!isFirebaseConfigured || !db) return;
  const { orgId, sender, senderName, senderUserId, text } = params;
  await addDoc(collection(db, "supportThreads", orgId, "messages"), {
    sender,
    sender_name: senderName,
    sender_user_id: senderUserId,
    text,
    created_at: new Date().toISOString(),
  });
}
