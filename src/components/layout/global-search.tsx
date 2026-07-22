"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { useLeadsStore } from "@/store/use-leads-store";
import { getEventTitle, primaryPhone, formatDate } from "@/lib/format";

/**
 * חיפוש גלובלי — זמין מכל מסך דרך הטופ-בר. מחפש בכל מה שנכתב במערכת:
 * לידים (שם/טלפון/מקור/הבטחות), פעילות/הערות שתועדו, ומטלות. תוצאה שנלחצת
 * פותחת את כרטיס הליד הרלוונטי (מקומית, בלי תלות בעמוד הנוכחי).
 */
export function GlobalSearch() {
  const leads = useLeadsStore((s) => s.leads);
  const activity = useLeadsStore((s) => s.activity);
  const tasks = useLeadsStore((s) => s.tasks);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const leadResults = useMemo(() => {
    if (!q) return [];
    return leads
      .filter((l) =>
        `${l.contacts.map((c) => `${c.name} ${c.phone ?? ""}`).join(" ")} ${l.lead_source} ${l.promises ?? ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 5);
  }, [leads, q]);

  const activityResults = useMemo(() => {
    if (!q) return [];
    return activity.filter((a) => a.content.toLowerCase().includes(q)).slice(0, 5);
  }, [activity, q]);

  const taskResults = useMemo(() => {
    if (!q) return [];
    return tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 5);
  }, [tasks, q]);

  const noResults = q && leadResults.length === 0 && activityResults.length === 0 && taskResults.length === 0;

  const openLead = (leadId: string) => {
    setOpen(false);
    setOpenLeadId(leadId);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" size="icon" aria-label="חיפוש בכל המערכת" />}
        >
          <Search className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש לידים, הערות, מטלות..."
          />

          {noResults && (
            <p className="py-3 text-center text-xs text-muted-foreground">לא נמצאו תוצאות.</p>
          )}

          {leadResults.length > 0 && (
            <ResultGroup label="לידים">
              {leadResults.map((l) => (
                <button
                  key={l.lead_id}
                  onClick={() => openLead(l.lead_id)}
                  className="w-full rounded-md px-2 py-1.5 text-right text-sm hover:bg-muted"
                >
                  {getEventTitle(l)}
                  <span className="mr-1 text-xs text-muted-foreground">· {primaryPhone(l)}</span>
                </button>
              ))}
            </ResultGroup>
          )}

          {activityResults.length > 0 && (
            <ResultGroup label="הערות ופעילות">
              {activityResults.map((a) => {
                const lead = leads.find((l) => l.lead_id === a.lead_id);
                return (
                  <button
                    key={a.activity_id}
                    onClick={() => openLead(a.lead_id)}
                    className="w-full rounded-md px-2 py-1.5 text-right text-sm hover:bg-muted"
                  >
                    <span className="block truncate text-muted-foreground">{a.content}</span>
                    <span className="text-xs text-muted-foreground">
                      {lead ? getEventTitle(lead) : "ליד"} · {formatDate(a.created_at)}
                    </span>
                  </button>
                );
              })}
            </ResultGroup>
          )}

          {taskResults.length > 0 && (
            <ResultGroup label="מטלות">
              {taskResults.map((t) => {
                const lead = t.lead_id ? leads.find((l) => l.lead_id === t.lead_id) : undefined;
                return (
                  <button
                    key={t.task_id}
                    onClick={() => (lead ? openLead(lead.lead_id) : setOpen(false))}
                    className="w-full rounded-md px-2 py-1.5 text-right text-sm hover:bg-muted"
                  >
                    <span className="block truncate">{t.title}</span>
                    {lead && <span className="text-xs text-muted-foreground">{getEventTitle(lead)}</span>}
                  </button>
                );
              })}
            </ResultGroup>
          )}
        </PopoverContent>
      </Popover>

      <LeadDrawer leadId={openLeadId} onOpenChange={(open) => !open && setOpenLeadId(null)} />
    </>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="px-2 text-[10.5px] uppercase tracking-[.08em] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
