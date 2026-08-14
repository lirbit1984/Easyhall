"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LifeBuoy, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrg } from "@/lib/firebase/org-context";
import { useSupportMessages, sendSupportMessage } from "@/lib/firebase/use-support-thread";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

const SEEN_KEY_PREFIX = "easyhall_support_seen_";

/**
 * כפתור צף לצ'אט תמיכה טכנית — פונה ישירות ללירן. מוצג בכל עמוד לכל
 * משתמש מחובר. מוצג רק כשFirebase מחובר (אין למי לפנות במצב Demo).
 */
export function SupportChatWidget() {
  const { user, profile, currentOrgId } = useOrg();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const { messages } = useSupportMessages(currentOrgId);
  const listRef = useRef<HTMLDivElement>(null);

  const senderName = profile?.fullName || user?.displayName || "משתמש";

  const hasUnread = useMemo(() => {
    if (messages.length === 0) return false;
    const last = messages[messages.length - 1];
    if (last.sender !== "admin") return false;
    if (typeof window === "undefined" || !currentOrgId) return false;
    const seenAt = window.localStorage.getItem(SEEN_KEY_PREFIX + currentOrgId);
    return !seenAt || new Date(last.created_at).getTime() > new Date(seenAt).getTime();
  }, [messages, currentOrgId]);

  useEffect(() => {
    if (open && currentOrgId && typeof window !== "undefined") {
      window.localStorage.setItem(SEEN_KEY_PREFIX + currentOrgId, new Date().toISOString());
    }
  }, [open, currentOrgId, messages.length]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages.length]);

  if (!isFirebaseConfigured || !user || !currentOrgId) return null;

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await sendSupportMessage({
        orgId: currentOrgId,
        sender: "user",
        senderName,
        senderUserId: user.uid,
        text: value,
      });
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 left-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
        aria-label="תמיכה טכנית"
      >
        {open ? <X className="size-5" /> : <LifeBuoy className="size-5" />}
        {hasUnread && !open && (
          <span className="absolute -top-0.5 -end-0.5 size-3 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </button>

      {open && (
        <div className="fixed bottom-36 left-4 z-40 flex h-[420px] w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="border-b border-border p-3">
            <p className="text-sm font-medium">תמיכה טכנית</p>
            <p className="text-[16.5px] text-muted-foreground">כתבו הודעה ונחזור אליכם בהקדם.</p>
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">אין עדיין הודעות. איך נוכל לעזור?</p>
            )}
            {messages.map((m) => (
              <div
                key={m.message_id}
                className={cn("max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm", m.sender === "user" ? "mr-auto bg-muted" : "ml-auto bg-primary text-primary-foreground")}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className={cn("mt-0.5 text-[15px]", m.sender === "user" ? "text-muted-foreground" : "text-primary-foreground/70")}>
                  {new Date(m.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-1.5 border-t border-border p-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="כתבו הודעה..."
              rows={1}
              className="min-h-9 flex-1 resize-none text-sm"
            />
            <Button size="icon" className="size-9 shrink-0" disabled={sending || !text.trim()} onClick={handleSend}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
