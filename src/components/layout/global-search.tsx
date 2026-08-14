"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { useLeadsStore } from "@/store/use-leads-store";
import { getEventTitle, primaryPhone, formatDate, formatDateTime } from "@/lib/format";

const RESULT_LIMIT = 5;

const STATUS_LABELS: Record<string, string> = {
  potential: "פוטנציאלי",
  closed: "סגור",
  not_relevant: "לא רלוונטי",
  reserved: "משוריין",
};

/**
 * חיפוש גלובלי — יושב בטופ-בר, זמין מכל מסך. מחפש בכל מה שנכתב במערכת:
 * לידים (שם/טלפון), פעילות/הערות שתועדו, ומטלות. תוצאה שנלחצת פותחת את
 * כרטיס הליד הרלוונטי (מקומית, בלי תלות בעמוד הנוכחי).
 */
export function GlobalSearch() {
  const leads = useLeadsStore((s) => s.leads);
  const activity = useLeadsStore((s) => s.activity);
  const tasks = useLeadsStore((s) => s.tasks);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [highlightActivityId, setHighlightActivityId] = useState<string | null>(null);

  const digits = query.replace(/\D/g, "");
  const q = query.trim().toLowerCase();

  const reservedLeadIds = useMemo(
    () => new Set(calendarEvents.filter((e) => e.event_type === "option_hold").map((e) => e.lead_id)),
    [calendarEvents]
  );
  const leadStatusLabel = (l: (typeof leads)[number]) =>
    STATUS_LABELS[reservedLeadIds.has(l.lead_id) ? "reserved" : l.status];

  const leadResults = useMemo(() => {
    if (!q) return [];
    return leads.filter((l) => {
      const nameMatch = l.contacts?.some((c) => c.name.toLowerCase().includes(q)) ?? false;
      const phoneMatch =
        digits.length > 0 &&
        (l.contacts?.some((c) => (c.phone ?? "").replace(/\D/g, "").includes(digits)) ?? false);
      return nameMatch || phoneMatch;
    });
  }, [leads, q, digits]);

  const activityResults = useMemo(() => {
    if (!q) return [];
    return activity
      .filter((a) => a.content.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activity, q]);

  const taskResults = useMemo(() => {
    if (!q) return [];
    return tasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [tasks, q]);

  const noResults = q && leadResults.length === 0 && activityResults.length === 0 && taskResults.length === 0;

  const openResultLead = (leadId: string, activityId?: string) => {
    setOpenLeadId(leadId);
    setHighlightActivityId(activityId ?? null);
    setQuery("");
    setFocused(false);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div ref={boxRef} className="relative mx-auto w-full max-w-xl">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowAllLeads(false);
            setShowAllActivity(false);
            setShowAllTasks(false);
          }}
          onFocus={() => setFocused(true)}
          placeholder="חפש אירוע, שם, טלפון, מטלה או הודעה..."
          className="h-9 border-2 border-border pr-9 focus-visible:border-primary"
        />
        {focused && q && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-popover p-2 text-right shadow-lg">
            {noResults && <p className="py-4 text-center text-xs text-muted-foreground">לא נמצאו תוצאות.</p>}

            {leadResults.length > 0 && (
              <div className="mb-1.5">
                <p className="px-1.5 py-1 text-[15.75px] uppercase tracking-[.08em] text-muted-foreground">
                  כרטיסי אירוע
                </p>
                {(showAllLeads ? leadResults : leadResults.slice(0, RESULT_LIMIT)).map((l) => (
                  <button
                    key={l.lead_id}
                    onClick={() => openResultLead(l.lead_id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[15.75px] text-muted-foreground">
                      {leadStatusLabel(l)}
                    </span>
                    <span className="flex-1 text-right">
                      {getEventTitle(l)}
                      <span className="mr-1.5 text-xs text-muted-foreground">· {primaryPhone(l)}</span>
                    </span>
                  </button>
                ))}
                {!showAllLeads && leadResults.length > RESULT_LIMIT && (
                  <button
                    onClick={() => setShowAllLeads(true)}
                    className="w-full px-2 py-1 text-xs text-accent-foreground hover:underline"
                  >
                    הצג עוד {leadResults.length - RESULT_LIMIT} תוצאות
                  </button>
                )}
              </div>
            )}

            {activityResults.length > 0 && (
              <div className="mb-1.5">
                <p className="px-1.5 py-1 text-[15.75px] uppercase tracking-[.08em] text-muted-foreground">
                  תקשורת
                </p>
                {(showAllActivity ? activityResults : activityResults.slice(0, RESULT_LIMIT)).map((a) => {
                  const activityLead = leads.find((l) => l.lead_id === a.lead_id);
                  return (
                    <button
                      key={a.activity_id}
                      onClick={() => openResultLead(a.lead_id, a.activity_id)}
                      className="block w-full rounded-md px-2 py-1.5 text-right text-sm hover:bg-muted"
                    >
                      <span className="block truncate text-muted-foreground">{a.content}</span>
                      <span className="text-xs text-muted-foreground">
                        {activityLead ? getEventTitle(activityLead) : "ליד"} · {formatDate(a.created_at)}
                      </span>
                    </button>
                  );
                })}
                {!showAllActivity && activityResults.length > RESULT_LIMIT && (
                  <button
                    onClick={() => setShowAllActivity(true)}
                    className="w-full px-2 py-1 text-xs text-accent-foreground hover:underline"
                  >
                    הצג עוד {activityResults.length - RESULT_LIMIT} תוצאות
                  </button>
                )}
              </div>
            )}

            {taskResults.length > 0 && (
              <div>
                <p className="px-1.5 py-1 text-[15.75px] uppercase tracking-[.08em] text-muted-foreground">
                  מטלות
                </p>
                {(showAllTasks ? taskResults : taskResults.slice(0, RESULT_LIMIT)).map((t) => {
                  const taskLead = t.lead_id ? leads.find((l) => l.lead_id === t.lead_id) : undefined;
                  return (
                    <button
                      key={t.task_id}
                      onClick={() => (taskLead ? openResultLead(taskLead.lead_id) : setFocused(false))}
                      className="block w-full rounded-md px-2 py-1.5 text-right text-sm hover:bg-muted"
                    >
                      <span className="block truncate">{t.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {taskLead ? `${getEventTitle(taskLead)} · ` : ""}
                        {formatDateTime(t.due_date)}
                      </span>
                    </button>
                  );
                })}
                {!showAllTasks && taskResults.length > RESULT_LIMIT && (
                  <button
                    onClick={() => setShowAllTasks(true)}
                    className="w-full px-2 py-1 text-xs text-accent-foreground hover:underline"
                  >
                    הצג עוד {taskResults.length - RESULT_LIMIT} תוצאות
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <LeadDrawer
        leadId={openLeadId}
        onOpenChange={(open) => {
          if (!open) {
            setOpenLeadId(null);
            setHighlightActivityId(null);
          }
        }}
        highlightActivityId={highlightActivityId}
      />
    </>
  );
}
