"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Lock, Plus, Trash2, Copy, FileText, Eye } from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { elementToPdfBlob } from "@/lib/generate-pdf";
import { formatDate, formatWeekday, getEventTitle } from "@/lib/format";
import {
  EVENT_CONTACT_ROLE_LABELS,
  CHUPA_ATTENDEE_OPTIONS,
  CHUPA_WINE_OPTIONS,
  DEFAULT_PLANNING_SCHEDULE,
  DEFAULT_PLANNING_SUPPLIER_ROLES,
  EVENT_DAY_PART_LABELS,
  MENU_SERVING_STYLE_LABELS,
} from "@/lib/types";
import type {
  EventContact,
  EventPlanning,
  EventType,
  LeadEvent,
  OrgSupplier,
  PlanningScheduleRow,
  PlanningSupplierRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function rowId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** טופס ריק עם ברירות המחדל של האולם — לו"ז ותפקידי ספקים מוכנים למילוי. */
function emptyPlanning(): EventPlanning {
  return {
    schedule: DEFAULT_PLANNING_SCHEDULE.map((r) => ({ row_id: rowId(), ...r })),
    suppliers: DEFAULT_PLANNING_SUPPLIER_ROLES.map((role) => ({ row_id: rowId(), role })),
  };
}

export function EventPlanningTab({
  lead,
  eventType,
  readOnly,
  onExit,
}: {
  lead: LeadEvent;
  eventType?: EventType;
  readOnly: boolean;
  onExit: () => void;
}) {
  const orgId = useLeadsStore((s) => s.orgId);
  const updateLeadPlanning = useLeadsStore((s) => s.updateLeadPlanning);
  const addDocument = useLeadsStore((s) => s.addDocument);
  const { orgDoc } = useOrgDoc();

  const [draft, setDraft] = useState<EventPlanning>(() => lead.planning ?? emptyPlanning());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"preview" | "staff" | "couple" | null>(null);
  const [previewAudience, setPreviewAudience] = useState<"staff" | "couple" | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // כרטיס אחר נבחר בזמן שהמגירה פתוחה — טוענים את הטופס שלו במקום להשאיר
  // על המסך טיוטה של זוג אחר.
  useEffect(() => {
    Promise.resolve().then(() => {
      setDraft(lead.planning ?? emptyPlanning());
      setDirty(false);
    });
  }, [lead.lead_id, lead.planning]);

  // שמירה אוטומטית עם השהיה — הקלדה רציפה לא מייצרת כתיבה על כל תו.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const t = setTimeout(() => {
      updateLeadPlanning(lead.lead_id, draft);
      setDirty(false);
    }, 900);
    return () => clearTimeout(t);
  }, [dirty, draft, lead.lead_id, readOnly, updateLeadPlanning]);

  const patch = (p: Partial<EventPlanning>) => {
    if (readOnly) return;
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };

  const schedule = draft.schedule ?? [];
  const suppliers = draft.suppliers ?? [];

  const setSchedule = (rows: PlanningScheduleRow[]) => patch({ schedule: rows });
  const setSuppliers = (rows: PlanningSupplierRow[]) => patch({ suppliers: rows });

  const attendees = draft.chupa_attendees ?? [];
  const toggleAttendee = (name: string) =>
    patch({
      chupa_attendees: attendees.includes(name)
        ? attendees.filter((a) => a !== name)
        : [...attendees, name],
    });

  const title = getEventTitle(lead, eventType);
  const contacts = lead.contacts ?? [];

  const saveNow = () => {
    if (readOnly) return;
    updateLeadPlanning(lead.lead_id, draft);
    setDirty(false);
  };

  const handleSaveAndExit = () => {
    saveNow();
    toast.success("התכנון נשמר");
    onExit();
  };

  /**
   * מפיק PDF מהתצוגה המקדימה. גרסת הזוג משמיטה טלפוני ספקים והערות
   * פנימיות — הזוג לא אמור לעקוף את האולם ולתאם ישירות מול ספקים.
   */
  const handleGenerate = async (audience: "staff" | "couple") => {
    saveNow();
    setBusy(audience);
    setPreviewAudience(audience);
    try {
      // ממתינים לרינדור התצוגה בגרסה המבוקשת לפני צילום ה-DOM.
      await new Promise((r) => setTimeout(r, 60));
      if (!previewRef.current) throw new Error("התצוגה המקדימה לא מוכנה");
      const docName = `תיאום ציפיות${audience === "couple" ? " לזוג" : ""} - ${title}.pdf`;
      const blob = await elementToPdfBlob(previewRef.current);

      if (isFirebaseConfigured && storage && orgId) {
        const path = `organizations/${orgId}/leads/${lead.lead_id}/documents/${Date.now()}-${docName}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, blob, { contentType: "application/pdf" });
        const url = await getDownloadURL(fileRef);
        addDocument(lead.lead_id, { name: docName, type: "other", url });
        toast.success("המסמך נשמר בטאב המסמכים — משם אפשר לשתף");
      } else {
        const localUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = localUrl;
        a.download = docName;
        a.click();
        URL.revokeObjectURL(localUrl);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הפקת המסמך נכשלה");
    } finally {
      setBusy(null);
      setPreviewAudience(null);
    }
  };

  const summary = useMemo(
    () =>
      [
        title,
        lead.event_date ? `${formatWeekday(lead.event_date)}, ${formatDate(lead.event_date)}` : null,
        lead.estimated_guests ? `${lead.estimated_guests} מוזמנים` : null,
        lead.event_start_time && lead.event_end_time
          ? `${lead.event_start_time}–${lead.event_end_time}`
          : null,
        lead.event_day_part ? EVENT_DAY_PART_LABELS[lead.event_day_part] : null,
        lead.serving_style ? MENU_SERVING_STYLE_LABELS[lead.serving_style] : null,
      ].filter(Boolean) as string[],
    [lead, title]
  );

  return (
    <div className="grid gap-3">
      {/* רצועה נעולה — מקור האמת הוא הכרטיס, לא הטופס. */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
        <Lock className="size-3.5 shrink-0" />
        {summary.map((s, i) => (
          <span key={s} className="flex items-center gap-2.5">
            {i > 0 && <span aria-hidden className="opacity-40">|</span>}
            <span className={i === 0 ? "font-medium" : undefined}>{s}</span>
          </span>
        ))}
        <span className="ms-auto text-[10px] opacity-70">מתעדכן מכרטיס האירוע</span>
        {contacts.length > 0 && (
          <div className="w-full border-t border-sky-200/70 pt-1.5 dark:border-sky-900">
            <div className="flex flex-wrap gap-x-2.5 gap-y-1">
              {contacts.map((c, i) => (
                <span key={c.contact_id} className="flex items-center gap-2.5">
                  {i > 0 && <span aria-hidden className="opacity-40">|</span>}
                  <span className="whitespace-nowrap">
                    <span className="opacity-70">{EVENT_CONTACT_ROLE_LABELS[c.role_key]}: </span>
                    <span className="font-medium">{c.name}</span>
                    {c.phone && (
                      <span dir="ltr" className="opacity-80">
                        {" "}
                        {c.phone}
                      </span>
                    )}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <BlueprintBox>
        <BoxKicker>בני משפחה נוספים</BoxKicker>
        <Textarea
          rows={3}
          disabled={readOnly}
          value={draft.family_notes ?? ""}
          onChange={(e) => patch({ family_notes: e.target.value })}
          placeholder={"דודה רותי 050-1234567 — אחראית על הכיבוד\nאבי החתן יוסי 052-7654321"}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          מי שמעורב באירוע אבל אינו ספק — נכנס לדף שהצוות מחזיק בליל האירוע.
        </p>
      </BlueprintBox>

      <BlueprintBox>
        <div className="mb-2 flex items-center justify-between">
          <BoxKicker className="mb-0">לוז אירוע</BoxKicker>
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setSchedule([...schedule, { row_id: rowId(), time: "21:00", label: "" }])}
            >
              <Plus className="size-3.5" />
              שורה
            </Button>
          )}
        </div>
        <div className="grid gap-1">
          {schedule.map((row, i) => (
            <div
              key={row.row_id}
              className={cn(
                "grid grid-cols-[92px_1fr_44px] items-center gap-2 py-1.5 sm:grid-cols-[92px_minmax(0,1.1fr)_minmax(0,1.3fr)_44px]",
                i > 0 && "border-t border-border"
              )}
            >
              <Input
                type="time"
                dir="ltr"
                disabled={readOnly}
                value={row.time}
                onChange={(e) =>
                  setSchedule(schedule.map((r) => (r.row_id === row.row_id ? { ...r, time: e.target.value } : r)))
                }
                className="h-8 text-xs"
                aria-label="שעה"
              />
              <Input
                disabled={readOnly}
                value={row.label}
                placeholder="שם האירוע"
                onChange={(e) =>
                  setSchedule(schedule.map((r) => (r.row_id === row.row_id ? { ...r, label: e.target.value } : r)))
                }
                className="h-8 text-xs font-medium"
                aria-label="אירוע"
              />
              <Input
                disabled={readOnly}
                value={row.note ?? ""}
                placeholder="פרטים..."
                onChange={(e) =>
                  setSchedule(schedule.map((r) => (r.row_id === row.row_id ? { ...r, note: e.target.value } : r)))
                }
                className="col-span-2 h-8 text-xs sm:col-span-1"
                aria-label="הערות"
              />
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label="מחק שורה"
                  onClick={() => setSchedule(schedule.filter((r) => r.row_id !== row.row_id))}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2.5 grid gap-1.5">
          <Label htmlFor="sch_notes" className="text-xs">הערות ללוז</Label>
          <Textarea
            id="sch_notes"
            rows={2}
            disabled={readOnly}
            value={draft.schedule_notes ?? ""}
            onChange={(e) => patch({ schedule_notes: e.target.value })}
            placeholder="• הערה ראשונה..."
          />
        </div>
      </BlueprintBox>

      <BlueprintBox>
        <div className="mb-2 flex items-center justify-between">
          <BoxKicker className="mb-0">רשימת ספקים</BoxKicker>
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setSuppliers([...suppliers, { row_id: rowId(), role: "ספק נוסף" }])}
            >
              <Plus className="size-3.5" />
              ספק
            </Button>
          )}
        </div>
        <div className="grid gap-1">
          {suppliers.map((row, i) => (
            <div
              key={row.row_id}
              className={cn(
                "grid grid-cols-2 items-center gap-2 py-1.5 sm:grid-cols-[104px_minmax(0,1fr)_124px_minmax(0,1fr)_44px]",
                i > 0 && "border-t border-border"
              )}
            >
              <Input
                disabled={readOnly}
                value={row.role}
                onChange={(e) =>
                  setSuppliers(suppliers.map((r) => (r.row_id === row.row_id ? { ...r, role: e.target.value } : r)))
                }
                className="col-span-2 h-8 text-xs font-medium sm:col-span-1"
                aria-label="תפקיד"
              />
              <SupplierNameInput
                disabled={readOnly}
                value={row.name ?? ""}
                onChange={(name) =>
                  setSuppliers(suppliers.map((r) => (r.row_id === row.row_id ? { ...r, name } : r)))
                }
                onPick={(picked) =>
                  setSuppliers(
                    suppliers.map((r) =>
                      r.row_id === row.row_id
                        ? { ...r, name: picked.name, phone: picked.phone ?? r.phone, note: r.note || picked.note }
                        : r
                    )
                  )
                }
              />
              <Input
                type="tel"
                dir="ltr"
                disabled={readOnly}
                value={row.phone ?? ""}
                placeholder="050-0000000"
                onChange={(e) =>
                  setSuppliers(suppliers.map((r) => (r.row_id === row.row_id ? { ...r, phone: e.target.value } : r)))
                }
                className="h-8 text-xs"
                aria-label="טלפון"
              />
              <Input
                disabled={readOnly}
                value={row.note ?? ""}
                placeholder="הגעה, בקשות..."
                onChange={(e) =>
                  setSuppliers(suppliers.map((r) => (r.row_id === row.row_id ? { ...r, note: e.target.value } : r)))
                }
                className="col-span-2 h-8 text-xs sm:col-span-1"
                aria-label="הערות"
              />
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label="מחק ספק"
                  onClick={() => setSuppliers(suppliers.filter((r) => r.row_id !== row.row_id))}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </BlueprintBox>

      <BlueprintBox>
        <BoxKicker>סדר החופה</BoxKicker>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="grid gap-2">
            {(
              [
                ["chupa_groom_with", "כניסת חתן – עם מי?", "הורים / אחים / לבד"],
                ["chupa_groom_song", "שיר כניסת חתן", "שם השיר"],
                ["chupa_bride_with", "כניסת כלה – עם מי?", "הורים / אחים / לבד"],
                ["chupa_bride_song", "שיר כניסת כלה", "שם השיר"],
                ["chupa_best_man", "שושבינים", "שמות שושבינים"],
                ["chupa_ring_bearer", "מגיש טבעות", "שם"],
                ["chupa_witness", "עד בכתובה", "שם העד"],
              ] as const
            ).map(([key, label, ph]) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={key} className="text-xs">{label}</Label>
                <Input
                  id={key}
                  disabled={readOnly}
                  value={draft[key] ?? ""}
                  placeholder={ph}
                  onChange={(e) => patch({ [key]: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
          <div className="grid content-start gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">נוכחים בחופה</Label>
              <div className="flex flex-wrap gap-1.5">
                {CHUPA_ATTENDEE_OPTIONS.map((name) => {
                  const on = attendees.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleAttendee(name)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors disabled:opacity-60",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">יין בחופה</Label>
              <Select
                value={draft.chupa_wine ?? ""}
                onValueChange={(v) => v && patch({ chupa_wine: v as string })}
              >
                <SelectTrigger size="sm" className="w-full" disabled={readOnly}>
                  <SelectValue>{(v: string) => v || "בחר..."}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CHUPA_WINE_OPTIONS.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="chupa_notes" className="text-xs">הערות חופה</Label>
              <Textarea
                id="chupa_notes"
                rows={3}
                disabled={readOnly}
                value={draft.chupa_notes ?? ""}
                onChange={(e) => patch({ chupa_notes: e.target.value })}
                placeholder="• הערה ראשונה..."
              />
            </div>
          </div>
        </div>
      </BlueprintBox>

      <BlueprintBox>
        <BoxKicker>ציוד שהזוג מביא</BoxKicker>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(
            [
              ["equip_rings", "טבעות"],
              ["equip_tallit", "טלית"],
              ["equip_glass", "כוס שבירה"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={readOnly}
              aria-pressed={!!draft[key]}
              onClick={() => patch({ [key]: !draft[key] })}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors disabled:opacity-60",
                draft[key]
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="equip_extra" className="text-xs">ציוד נוסף</Label>
          <Input
            id="equip_extra"
            disabled={readOnly}
            value={draft.equip_extra ?? ""}
            placeholder="פרט ציוד נוסף..."
            onChange={(e) => patch({ equip_extra: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      </BlueprintBox>

      <BlueprintBox>
        <BoxKicker>בקשות מיוחדות</BoxKicker>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(
            [
              ["special_allergies", "אלרגיות", "פרט אלרגיות..."],
              ["special_vegan", "מנות טבעוניות", "כמות, פרטים..."],
              ["special_glatt", "מנות גלאט", "כמות, פרטים..."],
            ] as const
          ).map(([key, label, ph]) => (
            <div key={key} className="grid gap-1.5">
              <Label htmlFor={key} className="text-xs">{label}</Label>
              <Textarea
                id={key}
                rows={2}
                disabled={readOnly}
                value={draft[key] ?? ""}
                placeholder={ph}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </BlueprintBox>

      <BlueprintBox>
        <BoxKicker>הערות כלליות</BoxKicker>
        <Textarea
          rows={4}
          disabled={readOnly}
          value={draft.general_notes ?? ""}
          onChange={(e) => patch({ general_notes: e.target.value })}
          placeholder="• הערה ראשונה..."
        />
      </BlueprintBox>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => setPreviewAudience((a) => (a ? null : "staff"))}
        >
          <Eye className="size-3.5" />
          {previewAudience ? "סגור תצוגה" : "תצוגה מקדימה"}
        </Button>
        {!readOnly && (
          <>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={busy !== null}
              onClick={() => handleGenerate("staff")}
            >
              <FileText className="size-3.5" />
              {busy === "staff" ? "מפיק..." : "PDF לצוות"}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={busy !== null}
              onClick={() => handleGenerate("couple")}
            >
              <Copy className="size-3.5" />
              {busy === "couple" ? "מפיק..." : "PDF לזוג"}
            </Button>
            <Button onClick={handleSaveAndExit}>שמירה ויציאה</Button>
          </>
        )}
        <span className="ms-auto text-[11px] text-muted-foreground">
          {readOnly ? "צפייה בלבד" : dirty ? "שומר..." : "✓ נשמר אוטומטית"}
        </span>
      </div>

      {previewAudience && (
        <div className="rounded-xl border border-border bg-white p-1">
          <PlanningPrintable
            ref={previewRef}
            lead={lead}
            title={title}
            summary={summary}
            planning={draft}
            venueName={orgDoc?.name}
            audience={previewAudience}
            contacts={contacts}
          />
        </div>
      )}
      {/* גרסת ההפקה מרונדרת מחוץ למסך כשהתצוגה סגורה, כדי ש-PDF יעבוד בלי
          שהמשתמש יצטרך לפתוח קודם את התצוגה המקדימה. */}
      {!previewAudience && (
        <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
          <PlanningPrintable
            ref={previewRef}
            lead={lead}
            title={title}
            summary={summary}
            planning={draft}
            venueName={orgDoc?.name}
            audience="staff"
            contacts={contacts}
          />
        </div>
      )}
    </div>
  );
}

/**
 * שדה שם ספק עם השלמה מהמאגר הארגוני. בחירה מהרשימה ממלאת גם את הטלפון —
 * זה כל הערך של המאגר: לא להקליד מחדש טלפון של צלם קבוע בכל אירוע.
 */
function SupplierNameInput({
  value,
  disabled,
  onChange,
  onPick,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onPick: (s: OrgSupplier) => void;
}) {
  const orgSuppliers = useLeadsStore((s) => s.orgSuppliers);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return orgSuppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6);
  }, [orgSuppliers, value]);

  return (
    <div className="relative">
      <Input
        disabled={disabled}
        value={value}
        placeholder="שם ספק"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        // השהיה קצרה לפני הסגירה, אחרת ה-blur מקדים את הקליק על הפריט.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => setOpen(true)}
        className="h-8 text-xs"
        aria-label="שם ספק"
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {matches.map((s) => (
            <button
              key={s.supplier_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(s);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 border-b border-border px-2.5 py-1.5 text-right text-xs last:border-b-0 hover:bg-muted"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
              {s.role && <span className="shrink-0 text-[10px] text-muted-foreground">{s.role}</span>}
              {s.phone && (
                <span dir="ltr" className="shrink-0 text-[10px] text-muted-foreground">
                  {s.phone}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p className="text-[11px] leading-relaxed">
      <span className="text-neutral-500">{label}: </span>
      {value}
    </p>
  );
}

/** הדף שמודפס. גרסת "couple" משמיטה טלפוני ספקים והערות תפעוליות. */
function PlanningPrintable({
  ref,
  title,
  summary,
  planning,
  venueName,
  audience,
  contacts,
}: {
  ref: React.Ref<HTMLDivElement>;
  lead: LeadEvent;
  contacts: EventContact[];
  title: string;
  summary: string[];
  planning: EventPlanning;
  venueName?: string;
  audience: "staff" | "couple";
}) {
  const forStaff = audience === "staff";
  const equip = [
    planning.equip_rings && "טבעות",
    planning.equip_tallit && "טלית",
    planning.equip_glass && "כוס שבירה",
    planning.equip_extra,
  ].filter(Boolean) as string[];

  return (
    <div ref={ref} dir="rtl" className="w-[720px] bg-white p-6 text-neutral-900">
      <div className="mb-3 border-b border-neutral-800 pb-2 text-center">
        <h1 className="text-lg font-bold">תיאום ציפיות — {title}</h1>
        <p className="mt-0.5 text-[11px] text-neutral-500">{summary.slice(1).join(" · ")}</p>
        {!forStaff && <Badge className="mt-1 rounded-full text-[10px]">עותק לזוג</Badge>}
      </div>

      {contacts.length > 0 && (
        <p className="mb-3 text-[11px] leading-relaxed">
          {contacts
            .map(
              (c) =>
                `${EVENT_CONTACT_ROLE_LABELS[c.role_key]}: ${c.name}${
                  // טלפונים נשארים בעותק הצוות בלבד — הזוג ממילא מכיר אותם,
                  // ואין סיבה שהם ייצאו מהאולם על נייר.
                  forStaff && c.phone ? ` ${c.phone}` : ""
                }`
            )
            .join("  |  ")}
        </p>
      )}

      <h2 className="mb-1 text-xs font-bold">לוז אירוע</h2>
      <table className="mb-3 w-full border-collapse text-[11px]">
        <tbody>
          {(planning.schedule ?? [])
            .filter((r) => r.label || r.time)
            .map((r) => (
              <tr key={r.row_id} className="border-b border-neutral-200">
                <td className="w-14 py-1 align-top font-medium" dir="ltr" style={{ textAlign: "right" }}>{r.time}</td>
                <td className="py-1 align-top font-medium">{r.label}</td>
                <td className="py-1 align-top text-neutral-600">{forStaff ? r.note : ""}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {forStaff && planning.schedule_notes && (
        <p className="mb-3 whitespace-pre-line text-[11px] text-neutral-600">{planning.schedule_notes}</p>
      )}

      {forStaff && (
        <>
          <h2 className="mb-1 text-xs font-bold">ספקים</h2>
          <table className="mb-3 w-full border-collapse text-[11px]">
            <tbody>
              {(planning.suppliers ?? [])
                .filter((r) => r.name || r.phone)
                .map((r) => (
                  <tr key={r.row_id} className="border-b border-neutral-200">
                    <td className="w-24 py-1 align-top text-neutral-500">{r.role}</td>
                    <td className="py-1 align-top font-medium">{r.name}</td>
                    <td className="w-28 py-1 align-top" dir="ltr" style={{ textAlign: "right" }}>{r.phone}</td>
                    <td className="py-1 align-top text-neutral-600">{r.note}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {planning.family_notes && (
            <>
              <h2 className="mb-1 text-xs font-bold">בני משפחה נוספים</h2>
              <p className="mb-3 whitespace-pre-line text-[11px]">{planning.family_notes}</p>
            </>
          )}
        </>
      )}

      <h2 className="mb-1 text-xs font-bold">סדר החופה</h2>
      <div className="mb-3 grid grid-cols-2 gap-x-6">
        <div>
          <Line label="כניסת חתן" value={planning.chupa_groom_with} />
          <Line label="שיר חתן" value={planning.chupa_groom_song} />
          <Line label="כניסת כלה" value={planning.chupa_bride_with} />
          <Line label="שיר כלה" value={planning.chupa_bride_song} />
        </div>
        <div>
          <Line label="שושבינים" value={planning.chupa_best_man} />
          <Line label="מגיש טבעות" value={planning.chupa_ring_bearer} />
          <Line label="עד בכתובה" value={planning.chupa_witness} />
          <Line label="נוכחים" value={(planning.chupa_attendees ?? []).join(", ")} />
          <Line label="יין" value={planning.chupa_wine} />
        </div>
      </div>
      {planning.chupa_notes && (
        <p className="mb-3 whitespace-pre-line text-[11px] text-neutral-600">{planning.chupa_notes}</p>
      )}

      {equip.length > 0 && (
        <>
          <h2 className="mb-1 text-xs font-bold">ציוד שהזוג מביא</h2>
          <p className="mb-3 text-[11px]">{equip.join(" · ")}</p>
        </>
      )}

      {(planning.special_allergies || planning.special_vegan || planning.special_glatt) && (
        <>
          <h2 className="mb-1 text-xs font-bold">בקשות מיוחדות</h2>
          <div className="mb-3">
            <Line label="אלרגיות" value={planning.special_allergies} />
            <Line label="טבעוניות" value={planning.special_vegan} />
            <Line label="גלאט" value={planning.special_glatt} />
          </div>
        </>
      )}

      {forStaff && planning.general_notes && (
        <>
          <h2 className="mb-1 text-xs font-bold">הערות כלליות</h2>
          <p className="mb-3 whitespace-pre-line text-[11px]">{planning.general_notes}</p>
        </>
      )}

      {venueName && (
        <div className="mt-4 border-t border-neutral-800 pt-2 text-center text-[10px] text-neutral-500">
          {venueName}
        </div>
      )}
    </div>
  );
}
