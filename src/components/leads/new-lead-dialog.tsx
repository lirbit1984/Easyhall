"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus, X, Settings2, Pencil, Trash2, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventTypeIcon } from "@/components/event-type-icon";
import { EVENT_TYPE_ICON_KEYS } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { useLeadsStore } from "@/store/use-leads-store";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { LEAD_SOURCES } from "@/lib/mock-data";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { getEventTitle } from "@/lib/format";
import { getRoleLabel, type EventContactRole, type EventType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ContactRow {
  role_key: EventContactRole;
  name: string;
  phone: string;
}

const SEASON_PERIOD_OPTIONS = [
  "קיץ", "חורף", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const EVENING_HOURS = { start: "19:30", end: "00:00" };
const MORNING_HOURS = { start: "12:00", end: "17:00" };

function isValidIsraeliMobile(phone: string): boolean {
  return /^05\d{8}$/.test(phone.replace(/\D/g, ""));
}

export function NewLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addLead = useLeadsStore((s) => s.addLead);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const addEventType = useLeadsStore((s) => s.addEventType);
  const updateEventType = useLeadsStore((s) => s.updateEventType);
  const deleteEventType = useLeadsStore((s) => s.deleteEventType);
  const { orgDoc } = useOrgDoc();
  const leadSources = orgDoc?.leadSources?.length ? orgDoc.leadSources : LEAD_SOURCES;
  const role = useCurrentRole();
  const { members } = useOrgMembers();
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [makeGlobal, setMakeGlobal] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [renamingTypeId, setRenamingTypeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const visibleEventTypes = eventTypes
    .filter((t) => !t.owner_user_id || t.owner_user_id === currentUserId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const canManageType = (t: EventType) =>
    t.owner_user_id ? t.owner_user_id === currentUserId : role === "admin";

  const createType = () => {
    const name = newTypeName.trim();
    if (!name) return;
    const clash = visibleEventTypes.some((t) => t.name.toLowerCase() === name.toLowerCase());
    if (clash) {
      toast.warning(`כבר קיים סוג אירוע בשם "${name}" — נוצר בכל זאת, כדאי לבדוק אם זו כפילות`);
    }
    addEventType(name, ["guest"], makeGlobal ? null : currentUserId);
    setNewTypeName("");
    setMakeGlobal(false);
    setNewTypeOpen(false);
  };

  const startRename = (t: EventType) => {
    setRenamingTypeId(t.event_type_id);
    setRenameValue(t.name);
  };

  const saveRename = () => {
    if (!renamingTypeId || !renameValue.trim()) return;
    updateEventType(renamingTypeId, { name: renameValue.trim() });
    setRenamingTypeId(null);
  };

  const [deleteTypeTarget, setDeleteTypeTarget] = useState<EventType | null>(null);

  const removeType = (t: EventType) => setDeleteTypeTarget(t);

  const confirmRemoveType = () => {
    const t = deleteTypeTarget;
    if (!t) return;
    deleteEventType(t.event_type_id);
    if (eventTypeId === t.event_type_id) {
      const fallback = visibleEventTypes.find((v) => v.event_type_id !== t.event_type_id);
      handleSelectEventType(fallback?.event_type_id ?? "");
    }
    setDeleteTypeTarget(null);
  };

  const moveType = (index: number, direction: -1 | 1) => {
    const target = visibleEventTypes[index + direction];
    const current = visibleEventTypes[index];
    if (!target || !current) return;
    // מנרמל את כל הרשימה למספרים לפי הסדר המוצג כרגע, כדי שהחלפה בין שני
    // פריטים לא תושפע מ-sort_order חסר/כפול על פריטים אחרים שלא נגעו בהם.
    visibleEventTypes.forEach((t, i) => {
      if ((t.sort_order ?? -1) !== i) updateEventType(t.event_type_id, { sort_order: i });
    });
    updateEventType(current.event_type_id, { sort_order: index + direction });
    updateEventType(target.event_type_id, { sort_order: index });
  };

  const [eventTypeId, setEventTypeId] = useState("");
  const [contactRows, setContactRows] = useState<ContactRow[]>([]);
  const [leadSource, setLeadSource] = useState(LEAD_SOURCES[0]);
  const [assignedUserId, setAssignedUserId] = useState(currentUserId);
  const [estimatedGuests, setEstimatedGuests] = useState("");
  const [pricePerPlate, setPricePerPlate] = useState("");
  const [touchedRowPhones, setTouchedRowPhones] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // תקופת התעניינות — הערכה ראשונית עוד בשיחה/פגישה ראשונה, לפני שנקבע
  // תאריך סופי. בוקר/ערב קובע ברירת מחדל לשעות; ניתן לבחור תקופה משוערת
  // (עונה/חודש) או תאריך מסוים כבר עכשיו.
  const [dayPart, setDayPart] = useState<"morning" | "evening">("evening");
  const [seasonPeriod, setSeasonPeriod] = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [startTime, setStartTime] = useState(EVENING_HOURS.start);
  const [endTime, setEndTime] = useState(EVENING_HOURS.end);

  const selectedType = eventTypes.find((t) => t.event_type_id === eventTypeId);
  const availableRoles = selectedType?.role_keys ?? [];

  const resetForRoles = (roleKeys: EventContactRole[]) => {
    setContactRows([
      { role_key: roleKeys[0] ?? "guest", name: "", phone: "" },
      { role_key: roleKeys[1] ?? roleKeys[0] ?? "guest", name: "", phone: "" },
    ]);
  };

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets a form's local state on open, not derived from render
      setAssignedUserId(currentUserId);
      setLeadSource(LEAD_SOURCES[0]);
      setEstimatedGuests("");
      setPricePerPlate("");
      setTouchedRowPhones(new Set());
      setIsSubmitting(false);
      setDayPart("evening");
      setSeasonPeriod("");
      setSpecificDate("");
      setStartTime(EVENING_HOURS.start);
      setEndTime(EVENING_HOURS.end);
      const firstType = eventTypes[0];
      setEventTypeId(firstType?.event_type_id ?? "");
      resetForRoles(firstType?.role_keys ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUserId]);

  // רשת (event types) נטענת א-סינכרונית מ-Firestore — אם החלון נפתח לפני
  // שהיא הגיעה, ה-effect למעלה קובע eventTypeId="" ולא רץ שוב, כך שה"צור
  // ליד" נכשל בשקט על ולידציה כל עוד הרשימה עדיין ריקה בזמן הפתיחה. זה
  // "מתקן את עצמו" ברגע שהרשימה מגיעה, כל עוד עוד לא נבחר סוג ידנית.
  useEffect(() => {
    if (open && !eventTypeId && eventTypes.length > 0) {
      const firstType = eventTypes[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- self-heals a form default once async data arrives, not derived from render
      setEventTypeId(firstType.event_type_id);
      resetForRoles(firstType.role_keys);
    }
  }, [open, eventTypeId, eventTypes]);

  const handleDayPartChange = (part: "morning" | "evening") => {
    setDayPart(part);
    const hours = part === "evening" ? EVENING_HOURS : MORNING_HOURS;
    setStartTime(hours.start);
    setEndTime(hours.end);
  };

  const handleSelectEventType = (typeId: string) => {
    setEventTypeId(typeId);
    const type = eventTypes.find((t) => t.event_type_id === typeId);
    resetForRoles(type?.role_keys ?? []);
  };

  const updateRow = (index: number, updates: Partial<ContactRow>) => {
    setContactRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const addRow = () => {
    setContactRows((rows) => [
      ...rows,
      { role_key: availableRoles[0] ?? "guest", name: "", phone: "" },
    ]);
  };

  const removeRow = (index: number) => {
    setContactRows((rows) => rows.filter((_, i) => i !== index));
  };

  const previewName = getEventTitle({
    contacts: contactRows
      .filter((r) => r.name.trim())
      .map((r, i) => ({ contact_id: `preview${i}`, role_key: r.role_key, name: r.name.trim() })),
  }, selectedType);
  const previewInitial = (contactRows.find((r) => r.name.trim())?.name || "ל")[0];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const filledContacts = contactRows.filter((r) => r.name.trim());
    if (!eventTypeId) {
      toast.error("יש לבחור סוג אירוע");
      return;
    }
    if (filledContacts.length === 0) {
      toast.error("יש להזין לפחות איש קשר אחד");
      return;
    }
    if (!filledContacts[0].phone?.trim()) {
      toast.error("יש להזין טלפון לאיש הקשר הראשון");
      return;
    }

    setIsSubmitting(true);
    const lead = addLead({
      event_type_id: eventTypeId,
      contacts: filledContacts.map((r) => ({
        role_key: r.role_key,
        name: r.name.trim(),
        phone: r.phone.trim() || undefined,
      })),
      lead_source: leadSource,
      assigned_user_id: assignedUserId,
      estimated_guests: Number(estimatedGuests) || 0,
      price_per_plate: Number(pricePerPlate) || 0,
      event_date: specificDate ? new Date(specificDate).toISOString() : null,
      event_season_preferred: !specificDate && seasonPeriod ? seasonPeriod : undefined,
      event_start_time: startTime || undefined,
      event_end_time: endTime || undefined,
    });

    toast.success(`הליד "${getEventTitle(lead, selectedType)}" נוצר בהצלחה`, {
      action: {
        label: "פתח כרטיס",
        onClick: () => setCreatedLeadId(lead.lead_id),
      },
    });
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>כרטיס אירוע חדש</DialogTitle>
        </DialogHeader>

        {/* כותרת חיה — מציגה את שם האירוע תוך כתיבה */}
        <div className="mb-1 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-accent-foreground">
            {previewInitial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{previewName}</p>
            <p className="text-xs text-muted-foreground">כרטיס אירוע חדש</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>סוג אירוע</Label>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="size-3" />
                ניהול סוגי אירוע
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {visibleEventTypes.map((t) => (
                <button
                  key={t.event_type_id}
                  type="button"
                  onClick={() => handleSelectEventType(t.event_type_id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                    eventTypeId === t.event_type_id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: t.color ?? "var(--muted-foreground)" }}
                  />
                  {t.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setNewTypeOpen(true)}
                className="flex items-center gap-1 rounded-full border border-dashed border-border px-3.5 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="size-3.5" />
                חדש
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            {contactRows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5">
                <Input
                  placeholder="שם"
                  required={i === 0}
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                />
                <div className="grid gap-0.5">
                  <Input
                    placeholder="טלפון"
                    required={i === 0}
                    dir="ltr"
                    value={row.phone}
                    onChange={(e) => updateRow(i, { phone: e.target.value })}
                    onBlur={() => setTouchedRowPhones((prev) => new Set(prev).add(i))}
                  />
                  {touchedRowPhones.has(i) && row.phone.trim() && !isValidIsraeliMobile(row.phone) && (
                    <p className="text-[11px] text-destructive">מספר לא תואם לנייד ישראלי (05XXXXXXXX)</p>
                  )}
                </div>
                <Select
                  value={row.role_key}
                  onValueChange={(v) => v && updateRow(i, { role_key: v as EventContactRole })}
                >
                  <SelectTrigger size="sm" className="w-32">
                    <SelectValue>{(v: string) => getRoleLabel(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {getRoleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contactRows.length > 2 && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeRow(i)}
                    aria-label="הסר איש קשר"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={addRow}>
              <Plus className="size-3.5" />
              הוסף איש קשר
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label>תקופת התעניינות</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => handleDayPartChange("evening")}
                  className={cn(
                    "px-3 py-1.5 text-[13px] transition-colors",
                    dayPart === "evening"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  אירוע ערב
                </button>
                <button
                  type="button"
                  onClick={() => handleDayPartChange("morning")}
                  className={cn(
                    "px-3 py-1.5 text-[13px] transition-colors",
                    dayPart === "morning"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  אירוע בוקר
                </button>
              </div>
              <Select value={seasonPeriod} onValueChange={(v) => setSeasonPeriod(v ?? "")}>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue>{(v: string) => v || "עונה / חודש"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEASON_PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DateField value={specificDate} onChange={setSpecificDate} className="w-40" />
            </div>
            <div className="flex items-center gap-1.5">
              <TimeField value={startTime} onChange={setStartTime} className="w-32" />
              <span className="text-xs text-muted-foreground">עד</span>
              <TimeField value={endTime} onChange={setEndTime} className="w-32" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="estimated_guests">כמות מוזמנים משוערת</Label>
              <Input
                id="estimated_guests"
                type="number"
                value={estimatedGuests}
                onChange={(e) => setEstimatedGuests(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="price_per_plate">מחיר מנה (₪)</Label>
              <Input
                id="price_per_plate"
                type="number"
                value={pricePerPlate}
                onChange={(e) => setPricePerPlate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>מקור ליד</Label>
              <Select value={leadSource} onValueChange={(v) => v && setLeadSource(v)}>
                <SelectTrigger>
                  <SelectValue>{(value: string) => value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {leadSources.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>נציג אחראי</Label>
              <Select value={assignedUserId} onValueChange={(v) => v && setAssignedUserId(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(value: string) => members.find((u) => u.user_id === value)?.full_name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {members.filter((u) => u.role !== "office").map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="-mx-4 -mb-4 flex items-center justify-between rounded-b-xl border-t bg-muted/50 p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={isSubmitting}>צור ליד</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <LeadDrawer leadId={createdLeadId} onOpenChange={(open) => !open && setCreatedLeadId(null)} />

    {/* יצירת סוג אירוע חדש — אישי כברירת מחדל, גלובלי רק ל-admin */}
    <Dialog open={newTypeOpen} onOpenChange={setNewTypeOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>סוג אירוע חדש</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="new_type_name">שם הסוג</Label>
            <Input
              id="new_type_name"
              autoFocus
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createType())}
            />
            {!makeGlobal && (
              <p className="text-xs text-muted-foreground">יופיע רק אצלך, לא אצל שאר הצוות.</p>
            )}
          </div>
          {role === "admin" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={makeGlobal}
                onChange={(e) => setMakeGlobal(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              סוג גלובלי (לכל הצוות)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNewTypeOpen(false)}>
              ביטול
            </Button>
            <Button type="button" onClick={createType}>
              צור
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ניהול סוגי אירוע — גלובליים (admin) ואישיים (הבעלים) */}
    <Dialog open={manageOpen} onOpenChange={setManageOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ניהול סוגי אירוע</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
          {visibleEventTypes.map((t, i) => (
            <div
              key={t.event_type_id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              {renamingTypeId !== t.event_type_id && (
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveType(i, -1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="הזז למעלה"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={i === visibleEventTypes.length - 1}
                    onClick={() => moveType(i, 1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="הזז למטה"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
              )}
              {renamingTypeId === t.event_type_id ? (
                <>
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveRename())}
                    className="h-7 flex-1"
                  />
                  <Button type="button" size="icon-sm" variant="ghost" onClick={saveRename}>
                    <Check className="size-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className="size-3.5 shrink-0 rounded-full border border-border"
                    style={{ background: t.color ?? "var(--muted)" }}
                  />
                  <span className="flex-1">
                    {t.name}
                    {!t.owner_user_id && (
                      <span className="mr-1.5 text-[10.5px] text-muted-foreground">גלובלי</span>
                    )}
                  </span>
                  {canManageType(t) && (
                    <>
                      <Popover>
                        <PopoverTrigger
                          className="flex size-6 shrink-0 items-center justify-center rounded border border-border"
                          aria-label="אייקון"
                        >
                          <EventTypeIcon icon={t.icon} className="size-3.5" />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto">
                          <div className="grid grid-cols-8 gap-1.5">
                            {EVENT_TYPE_ICON_KEYS.map((key) => (
                              <button
                                key={key}
                                type="button"
                                aria-label={key}
                                aria-pressed={t.icon === key}
                                onClick={() => updateEventType(t.event_type_id, { icon: key })}
                                className={cn(
                                  "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                                  t.icon === key
                                    ? "border-foreground bg-foreground text-background"
                                    : "border-border text-muted-foreground hover:text-foreground"
                                )}
                              >
                                <EventTypeIcon icon={key} className="size-4" />
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <input
                        type="color"
                        value={t.color ?? "#888780"}
                        onChange={(e) => updateEventType(t.event_type_id, { color: e.target.value })}
                        className="size-6 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                        aria-label="צבע"
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => startRename(t)}
                        aria-label="שנה שם"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => removeType(t)}
                        aria-label="מחק סוג אירוע"
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteTypeTarget} onOpenChange={(o) => !o && setDeleteTypeTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>למחוק את סוג האירוע?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTypeTarget && `סוג האירוע "${deleteTypeTarget.name}" יימחק. הפעולה בלתי הפיכה.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmRemoveType}>
            מחק
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
