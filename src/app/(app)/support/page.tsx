"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrg } from "@/lib/firebase/org-context";
import { useSupportThreadsAdmin } from "@/lib/firebase/use-support-threads-admin";
import { useSupportMessages, sendSupportMessage } from "@/lib/firebase/use-support-thread";
import { cn } from "@/lib/utils";

const PLATFORM_ADMIN_EMAIL = "peanuts.rlz@gmail.com";

/** מסך ניהול פניות תמיכה — מוצג רק ללירן (לפי מייל), רואה את כל הארגונים. */
export default function SupportConsolePage() {
  const { user, loading } = useOrg();

  if (loading) return null;
  if (!user || user.email !== PLATFORM_ADMIN_EMAIL) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">אין לך הרשאה לצפות בעמוד זה.</p>
      </div>
    );
  }

  return <SupportConsole adminUserId={user.uid} />;
}

function SupportConsole({ adminUserId }: { adminUserId: string }) {
  const { threads, loading } = useSupportThreadsAdmin();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { messages } = useSupportMessages(selectedOrgId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedOrgId && threads.length > 0) {
      Promise.resolve().then(() => setSelectedOrgId(threads[0].orgId));
    }
  }, [threads, selectedOrgId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const selectedThread = threads.find((t) => t.orgId === selectedOrgId);

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending || !selectedOrgId) return;
    setSending(true);
    try {
      await sendSupportMessage({
        orgId: selectedOrgId,
        sender: "admin",
        senderName: "לירן — תמיכה",
        senderUserId: adminUserId,
        text: value,
      });
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title="תמיכה טכנית" subtitle="כל הפניות מכל האולמות" />

      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <BlueprintBox className="min-h-0 max-h-[70vh] overflow-y-auto p-0">
          {!loading && threads.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">אין עדיין פניות תמיכה.</p>
          )}
          {threads.map((t) => (
            <button
              key={t.orgId}
              onClick={() => setSelectedOrgId(t.orgId)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b border-border px-3 py-2.5 text-right last:border-b-0 hover:bg-muted/60",
                selectedOrgId === t.orgId && "bg-muted"
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{t.orgName}</span>
                {t.lastMessageSender === "user" && (
                  <span className="size-2 shrink-0 rounded-full bg-destructive" aria-label="ממתין לתגובה" />
                )}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{t.lastMessageText}</span>
            </button>
          ))}
        </BlueprintBox>

        <BlueprintBox className="flex min-h-0 flex-col p-0">
          {!selectedThread ? (
            <p className="p-6 text-center text-sm text-muted-foreground">בחר פנייה מהרשימה.</p>
          ) : (
            <>
              <div className="border-b border-border p-3">
                <p className="text-sm font-medium">{selectedThread.orgName}</p>
              </div>

              <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: "50vh" }}>
                {messages.map((m) => (
                  <div
                    key={m.message_id}
                    className={cn(
                      "max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm",
                      m.sender === "user" ? "mr-auto bg-muted" : "ml-auto bg-primary text-primary-foreground"
                    )}
                  >
                    <p className="mb-0.5 text-[10px] opacity-70">{m.sender_name}</p>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <p className={cn("mt-0.5 text-[10px]", m.sender === "user" ? "text-muted-foreground" : "text-primary-foreground/70")}>
                      {new Date(m.created_at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
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
                  placeholder="כתבו תשובה..."
                  rows={1}
                  className="min-h-9 flex-1 resize-none text-sm"
                />
                <Button size="icon" className="size-9 shrink-0" disabled={sending || !text.trim()} onClick={handleSend}>
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          )}
        </BlueprintBox>
      </div>
    </div>
  );
}
