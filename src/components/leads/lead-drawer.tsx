"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Users,
  CalendarDays,
  Paperclip,
  Send,
  PhoneIncoming,
  PhoneOutgoing,
  StickyNote,
  RefreshCcw,
  ListChecks,
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { RepAvatar } from "@/components/leads/rep-avatar";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import type { ActivityType, LeadStatus, EventContact, EventContactRoleKey } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS, LOST_REASONS, PIPELINE_STAGES, EVENT_CONTACT_ROLE_LABELS, CATALOG_UNIT_LABELS } from "@/lib/types";
import { formatDate, formatDateTime, formatCurrency, waLink, telLink, getEventTitle, primaryPhone, primaryContactName } from "@/lib/format";
import { LeadTaskItem } from "@/components/leads/lead-task-item";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<LeadStatus, string> = {
  potential: "פוטנציאלי",
  closed: "סגור",
  not_relevant: "לא רלוונטי",
};

const VAT_PERCENT = 18;
const DEPOSIT_PERCENT = 20;

const MENU_CATEGORIES = ["קבלת פנים", "סלטים ופלטות", "מנת ביניים", "מנה עיקרית", "קינוחים", "אפטר פארטי"];

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  incoming_call: PhoneIncoming,
  outgoing_call: PhoneOutgoing,
  whatsapp: WhatsappIcon,
  meeting: Users,
  note: StickyNote,
  status_change: RefreshCcw,
};

export function LeadDrawer({
  leadId,
  onOpenChange,
  highlightActivityId,
}: {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
  highlightActivityId?: string | null;
}) {
  const router = useRouter();
  const lead = useLeadsStore((s) => s.leads.find((l) => l.lead_id === leadId));
  const allActivity = useLeadsStore((s) => s.activity);
  const activity = useMemo(
    () =>
      allActivity
        .filter((a) => a.lead_id === leadId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allActivity, leadId]
  );

  useEffect(() => {
    if (!highlightActivityId) return;
    const el = document.getElementById(`activity-${highlightActivityId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightActivityId, leadId]);

  const updateLeadStatus = useLeadsStore((s) => s.updateLeadStatus);
  const updateLeadContacts = useLeadsStore((s) => s.updateLeadContacts);
  const updateLeadCart = useLeadsStore((s) => s.updateLeadCart);
  const updateLeadVenue = useLeadsStore((s) => s.updateLeadVenue);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const allCatalog = useLeadsStore((s) => s.catalog);
  const catalog = useMemo(() => allCatalog.filter((c) => c.active), [allCatalog]);
  const toggleMilestone = useLeadsStore((s) => s.toggleMilestone);
  const setFollowUp = useLeadsStore((s) => s.setFollowUp);
  const setPromises = useLeadsStore((s) => s.setPromises);
  const setFirstInquiry = useLeadsStore((s) => s.setFirstInquiry);
  const setLostReason = useLeadsStore((s) => s.setLostReason);
  const addActivity = useLeadsStore((s) => s.addActivity);
  const allTasks = useLeadsStore((s) => s.tasks);
  const addTask = useLeadsStore((s) => s.addTask);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const deleteLead = useLeadsStore((s) => s.deleteLead);
  const deletePin = useLeadsStore((s) => s.deletePin);
  const deleteUnlockPin = useLeadsStore((s) => s.deleteUnlockPin);
  const { members } = useOrgMembers();
  const role = useCurrentRole();
  const leadTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.lead_id === leadId)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [allTasks, leadId]
  );

  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<ActivityType>("note");
  const [newParticipants, setNewParticipants] = useState<string[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  const [editingNames, setEditingNames] = useState(false);
  const [editContacts, setEditContacts] = useState<EventContact[]>([]);
  const [editTitle, setEditTitle] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePinInput, setDeletePinInput] = useState("");
  const [deleteAttemptsLeft, setDeleteAttemptsLeft] = useState(3);
  const [deleteLocked, setDeleteLocked] = useState(false);
  const [unlockPinInput, setUnlockPinInput] = useState("");

  const resetDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeletePinInput("");
    setUnlockPinInput("");
    setDeleteAttemptsLeft(3);
    setDeleteLocked(false);
  };

  const submitDeletePin = () => {
    if (!lead) return;
    if (deletePinInput === deletePin) {
      deleteLead(lead.lead_id);
      toast.success("כרטיס האירוע נמחק");
      resetDeleteDialog();
      onOpenChange(false);
      return;
    }
    const left = deleteAttemptsLeft - 1;
    setDeletePinInput("");
    if (left <= 0) {
      setDeleteLocked(true);
      toast.error("שלושה ניסיונות כושלים — נדרש קוד שחרור");
    } else {
      setDeleteAttemptsLeft(left);
      toast.error(`קוד שגוי — נותרו ${left} ניסיונות`);
    }
  };

  const submitUnlockPin = () => {
    if (unlockPinInput === deleteUnlockPin) {
      setDeleteLocked(false);
      setDeleteAttemptsLeft(3);
      setUnlockPinInput("");
      toast.success("הנעילה שוחררה, אפשר לנסות שוב");
    } else {
      setUnlockPinInput("");
      toast.error("קוד שחרור שגוי");
    }
  };

  if (!lead) return null;

  const eventType = eventTypes.find((t) => t.event_type_id === lead.event_type_id);
  const availableRoles = eventType?.role_keys ?? [];

  const startEditingNames = () => {
    setEditContacts((lead.contacts ?? []).map((c) => ({ ...c })));
    setEditTitle(lead.custom_title ?? "");
    setEditingNames(true);
  };

  const updateEditContact = (contactId: string, updates: Partial<EventContact>) => {
    setEditContacts((rows) => rows.map((c) => (c.contact_id === contactId ? { ...c, ...updates } : c)));
  };

  const addEditContact = () => {
    setEditContacts((rows) => [
      ...rows,
      { contact_id: `new${Date.now()}`, role_key: availableRoles[0] ?? "guest", name: "", phone: "" },
    ]);
  };

  const removeEditContact = (contactId: string) => {
    setEditContacts((rows) => rows.filter((c) => c.contact_id !== contactId));
  };

  const saveNames = () => {
    const filled = editContacts.filter((c) => c.name.trim());
    if (filled.length === 0) {
      toast.error("יש להזין לפחות איש קשר אחד");
      return;
    }
    updateLeadContacts(lead.lead_id, filled, editTitle.trim() || null);
    setEditingNames(false);
    toast.success("פרטי אנשי הקשר עודכנו");
  };

  const submitActivity = () => {
    if (!newContent.trim()) return;
    addActivity(lead.lead_id, newType, newContent.trim(), newParticipants);
    setNewContent("");
    setNewParticipants([]);
    toast.success("הפעולה תועדה בפיד התקשורת");
  };

  const toggleParticipant = (userId: string) =>
    setNewParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );

  const scheduleFollowUpTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    setFollowUp(lead.lead_id, d.toISOString());
    toast.success("נקבע פולו-אפ למחר 10:00");
  };

  const submitTask = () => {
    if (!newTaskTitle.trim() || !newTaskDue) return;
    addTask({
      lead_id: lead.lead_id,
      assigned_user_id: lead.assigned_user_id,
      created_by_user_id: currentUserId,
      title: newTaskTitle.trim(),
      due_date: new Date(newTaskDue).toISOString(),
    });
    addActivity(lead.lead_id, "note", `נוצרה מטלה: "${newTaskTitle.trim()}".`);
    setNewTaskTitle("");
    setNewTaskDue("");
    toast.success("המטלה נוספה");
  };

  const repName = members.find((m) => m.user_id === lead.assigned_user_id)?.full_name;
  const stageLabel = PIPELINE_STAGES.find((s) => s.key === lead.pipeline_stage)?.label;
  const contractValue = lead.estimated_guests * lead.price_per_plate;
  const financialDocs = lead.documents.filter(
    (d) => d.type === "quote" || d.type === "contract"
  );

  // עגלת התשלומים: quantity תמיד = estimated_guests לפריטי per_guest (לא ניתן
  // לעריכה), וברירת מחדל 1 הניתנת לעריכה ידנית לפריטי fixed. שום דבר בכרטיס
  // האירוע לא ננעל לעריכה גם לאחר "אישור".
  const cartLines = catalog.map((item) => {
    const quantity =
      item.unit === "per_guest"
        ? lead.estimated_guests
        : (lead.cart?.find((c) => c.item_id === item.item_id)?.quantity ?? 1);
    return { item, quantity, lineTotal: item.price * quantity };
  });
  const setFixedQuantity = (itemId: string, quantity: number) => {
    const next = catalog
      .filter((i) => i.unit === "fixed")
      .map((i) => ({
        item_id: i.item_id,
        quantity: i.item_id === itemId ? Math.max(0, quantity) : (lead.cart?.find((c) => c.item_id === i.item_id)?.quantity ?? 1),
      }));
    updateLeadCart(lead.lead_id, next);
  };
  const cartSubtotal = cartLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const vatAmount = cartSubtotal * (VAT_PERCENT / 100);
  const cartTotal = cartSubtotal + vatAmount;
  const depositPaid = lead.milestones.find((m) => m.key === "deposit_paid")?.done;
  const receivedAmount = depositPaid ? cartTotal * (DEPOSIT_PERCENT / 100) : 0;
  const balanceDue = cartTotal - receivedAmount;

  return (
    <>
    <Sheet open={!!leadId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full! sm:max-w-3xl! overflow-hidden p-0"
      >
        <div className="flex h-full w-full flex-col overflow-hidden">
          {/* Header: hero + status/actions */}
          <SheetHeader className="gap-0 border-b border-border pb-4">
            <div className="flex items-start gap-4 pl-8">
              {/* Photo placeholder */}
              <div
                className="aurora-card relative size-[84px] shrink-0 rounded-2xl"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, var(--color-accent-100) 0 2px, var(--card) 2px 14px)",
                }}
              >
                <span className="aurora-glow" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                {editingNames ? (
                  <>
                    <SheetTitle className="sr-only">{getEventTitle(lead, eventType)}</SheetTitle>
                    <Input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="כותרת מותאמת אישית (ריק = אוטומטי)"
                      className="mb-2 h-8"
                    />
                    <div className="grid gap-1.5">
                      {editContacts.map((c) => (
                        <div key={c.contact_id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5">
                          <Input
                            value={c.name}
                            onChange={(e) => updateEditContact(c.contact_id, { name: e.target.value })}
                            placeholder="שם"
                            className="h-8"
                          />
                          <Input
                            value={c.phone ?? ""}
                            onChange={(e) => updateEditContact(c.contact_id, { phone: e.target.value })}
                            placeholder="טלפון"
                            dir="ltr"
                            className="h-8"
                          />
                          <Select
                            value={c.role_key}
                            onValueChange={(v) => v && updateEditContact(c.contact_id, { role_key: v as EventContactRoleKey })}
                          >
                            <SelectTrigger size="sm" className="w-28 shrink-0">
                              <SelectValue>{(v: string) => EVENT_CONTACT_ROLE_LABELS[v as EventContactRoleKey]}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(EVENT_CONTACT_ROLE_LABELS) as EventContactRoleKey[]).map((g) => (
                                <SelectItem key={g} value={g}>
                                  {EVENT_CONTACT_ROLE_LABELS[g]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => removeEditContact(c.contact_id)}
                            aria-label="הסר איש קשר"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" className="w-fit gap-1.5" onClick={addEditContact}>
                        <Plus className="size-3.5" />
                        הוסף איש קשר
                      </Button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Button size="icon-sm" variant="outline" onClick={saveNames} aria-label="שמור">
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => setEditingNames(false)}
                        aria-label="ביטול"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <SheetTitle className="font-heading text-[26px] font-semibold">
                      {getEventTitle(lead, eventType)}
                    </SheetTitle>
                    {role !== "office" && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={startEditingNames}
                        aria-label="ערוך אנשי קשר"
                        className="shrink-0"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                )}
                <SheetDescription className="text-[13px] text-accent-foreground">
                  {[stageLabel, lead.event_date ? formatDate(lead.event_date) : null, `${lead.estimated_guests} מוזמנים`]
                    .filter(Boolean)
                    .join(" · ")}
                </SheetDescription>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <RepAvatar userId={lead.assigned_user_id} size="sm" />
                  {repName} · מקור: {lead.lead_source}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
              <div className="grid gap-0.5">
                <Select
                  value={lead.status}
                  onValueChange={(v) => v && updateLeadStatus(lead.lead_id, v as LeadStatus)}
                >
                  <SelectTrigger size="sm" className="w-36">
                    <SelectValue>{(v: string) => STATUS_LABELS[v as LeadStatus]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lead.status_changed_at && (
                  <span className="text-[11px] text-muted-foreground">
                    עודכן {formatDateTime(lead.status_changed_at)}
                    {lead.status_changed_by &&
                      ` · ${members.find((m) => m.user_id === lead.status_changed_by)?.full_name ?? ""}`}
                  </span>
                )}
              </div>

              {lead.status === "not_relevant" && (
                <Select
                  value={lead.lost_reason ?? ""}
                  onValueChange={(v) => v && setLostReason(lead.lead_id, v as string)}
                >
                  <SelectTrigger size="sm" className="w-48">
                    <SelectValue>
                      {(v: string) => (v ? v : "סיבת אובדן…")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LOST_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  addActivity(lead.lead_id, "whatsapp", `נשלחה הודעת WhatsApp ל${primaryContactName(lead)}.`);
                  window.open(
                    waLink(primaryPhone(lead), `שלום ${primaryContactName(lead)}, `),
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
              >
                <WhatsappIcon className="size-3.5 text-green-600" />
                שלח WhatsApp
              </Button>

              {role !== "office" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => router.push(`/billing?leadId=${lead.lead_id}`)}
                >
                  <FileText className="size-3.5" />
                  הפק הצעת מחיר / חוזה
                </Button>
              )}

              {role === "admin" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  מחק כרטיס
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs
            defaultValue="overview"
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <TabsList
              variant="line"
              className="h-auto shrink-0 justify-start border-b border-border px-4"
            >
              <TabsTrigger value="overview" className="flex-none px-4 py-2.5">סקירה</TabsTrigger>
              <TabsTrigger value="pay" className="flex-none px-4 py-2.5">תשלומים</TabsTrigger>
              <TabsTrigger value="menu" className="flex-none px-4 py-2.5">תפריט</TabsTrigger>
              <TabsTrigger value="docs" className="flex-none px-4 py-2.5">מסמכים</TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {/* ── סקירה ── */}
              <TabsContent value="overview" className="grid gap-3.5">
                <BlueprintBox>
                  <BoxKicker>פרטי האירוע</BoxKicker>
                  <div className="mb-2.5 flex items-center gap-2">
                    <Badge
                      className={cn(
                        "rounded-full text-[11px]",
                        lead.status === "potential" && "bg-amber-500/15 text-amber-700",
                        lead.status === "not_relevant" && "bg-muted text-muted-foreground",
                        lead.status === "closed" && "bg-accent text-accent-foreground"
                      )}
                    >
                      {STATUS_LABELS[lead.status]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Chip label="מקום">
                      <Input
                        defaultValue={lead.venue ?? ""}
                        placeholder="—"
                        onBlur={(e) => {
                          if (e.target.value !== (lead.venue ?? "")) updateLeadVenue(lead.lead_id, e.target.value);
                        }}
                        className="h-6 border-none bg-transparent px-0 text-[13px] font-semibold shadow-none focus-visible:ring-0"
                      />
                    </Chip>
                    <Chip label="סוג אירוע">{eventType?.name ?? "—"}</Chip>
                    <Chip label="קוד">{lead.lead_id}</Chip>
                    <Chip label="מוזמנים">{lead.estimated_guests}</Chip>
                  </div>
                </BlueprintBox>

                <div className="grid gap-3.5 lg:grid-cols-[1fr_1.4fr]">
                  <BlueprintBox>
                    <BoxKicker>אנשי קשר</BoxKicker>
                    {(lead.contacts ?? []).map((c) => (
                      <FieldRow key={c.contact_id} label={EVENT_CONTACT_ROLE_LABELS[c.role_key]}>
                        <span className="flex items-center gap-1.5">
                          {c.name}
                          {c.phone && (
                            <a href={telLink(c.phone)} className="text-muted-foreground hover:underline">
                              ({c.phone})
                            </a>
                          )}
                        </span>
                      </FieldRow>
                    ))}
                    {lead.email && (
                      <FieldRow label="אימייל">
                        <a href={`mailto:${lead.email}`} className="hover:underline">
                          {lead.email}
                        </a>
                      </FieldRow>
                    )}
                    <FieldRow label="מקור">{lead.lead_source}</FieldRow>
                    <FieldRow label="נציג מטפל">{repName}</FieldRow>
                    <FieldRow label="שלב">
                      <Badge variant="secondary" className="rounded-full bg-accent text-accent-foreground">
                        {stageLabel}
                      </Badge>
                    </FieldRow>
                    <FieldRow label="שווי משוער">{formatCurrency(contractValue)}</FieldRow>
                  </BlueprintBox>

                  <BlueprintBox>
                    <BoxKicker>פרטי אירוע</BoxKicker>
                    <FieldRow label="תאריך אירוע">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5 text-muted-foreground" />
                        {formatDate(lead.event_date)}
                      </span>
                    </FieldRow>
                    <FieldRow label="התעניינו לראשונה">
                      <Input
                        type="date"
                        value={lead.first_inquiry_at ? lead.first_inquiry_at.slice(0, 10) : ""}
                        onChange={(e) =>
                          setFirstInquiry(
                            lead.lead_id,
                            e.target.value ? new Date(e.target.value).toISOString() : null
                          )
                        }
                        className="h-7 w-36 text-sm"
                      />
                    </FieldRow>
                    <FieldRow label="מוזמנים משוערים">{lead.estimated_guests}</FieldRow>
                    <FieldRow label="מחיר מנה">{formatCurrency(lead.price_per_plate)}</FieldRow>
                    <FieldRow label="פולו-אפ הבא">
                      <span className="flex items-center gap-1.5">
                        {lead.follow_up_at ? formatDateTime(lead.follow_up_at) : "לא נקבע"}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={scheduleFollowUpTomorrow}
                        >
                          תזמן למחר
                        </Button>
                      </span>
                    </FieldRow>
                  </BlueprintBox>
                </div>

                <BlueprintBox>
                  <BoxKicker>הבטחות והערות לזוג</BoxKicker>
                  <Textarea
                    placeholder="מה הובטח לזוג? הנחות, תוספות, סיכומים מיוחדים..."
                    defaultValue={lead.promises ?? ""}
                    onBlur={(e) => {
                      if ((e.target.value ?? "") !== (lead.promises ?? "")) {
                        setPromises(lead.lead_id, e.target.value);
                      }
                    }}
                    rows={2}
                    className="text-sm"
                  />
                </BlueprintBox>

                <BlueprintBox>
                  <BoxKicker>אבני דרך (Milestones)</BoxKicker>
                  <div className="grid gap-1">
                    {lead.milestones.map((m) => (
                      <label
                        key={m.key}
                        className="flex cursor-pointer items-center gap-2 px-1 py-1 text-sm hover:bg-foreground/[.04]"
                      >
                        <Checkbox
                          checked={m.done}
                          onCheckedChange={() => toggleMilestone(lead.lead_id, m.key)}
                        />
                        <span className={m.done ? "text-muted-foreground line-through" : ""}>
                          {m.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </BlueprintBox>

                <BlueprintBox>
                  <BoxKicker className="flex items-center gap-1.5">
                    <ListChecks className="size-3.5" />
                    משימות לליד זה
                  </BoxKicker>
                  {leadTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground">אין משימות פתוחות לליד זה.</p>
                  )}
                  <ul className="grid gap-1">
                    {leadTasks.map((t) => (
                      <LeadTaskItem key={t.task_id} task={t} />
                    ))}
                  </ul>
                  <div className="mt-2 grid gap-1.5 border border-dashed border-border p-2">
                    <Input
                      placeholder='למשל: "לחזור אליהם לפרטים נוספים"'
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="datetime-local"
                        value={newTaskDue}
                        onChange={(e) => setNewTaskDue(e.target.value)}
                        className="h-8 flex-1 text-sm"
                      />
                      <Button
                        size="sm"
                        className="h-8 gap-1 bg-green-600 text-white hover:bg-green-700"
                        disabled={!newTaskTitle.trim() || !newTaskDue}
                        onClick={submitTask}
                      >
                        <Plus className="size-3.5" />
                        הוסף מטלה
                      </Button>
                    </div>
                  </div>
                </BlueprintBox>

                <BlueprintBox>
                  <BoxKicker>תיעוד חדש</BoxKicker>
                  <div className="grid gap-2">
                    <Textarea
                      placeholder="הוסף הערה, תיעוד שיחה או עדכון..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <Select value={newType} onValueChange={(v) => v && setNewType(v as ActivityType)}>
                        <SelectTrigger size="sm" className="w-40">
                          <SelectValue>{(v: string) => ACTIVITY_TYPE_LABELS[v as ActivityType]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[])
                            .filter((t) => t !== "status_change")
                            .map((t) => (
                              <SelectItem key={t} value={t}>
                                {ACTIVITY_TYPE_LABELS[t]}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="gap-1.5" onClick={submitActivity}>
                        <Send className="size-3.5" />
                        הוסף לפיד
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">משתתפים:</span>
                      {members
                        .filter((m) => m.user_id !== currentUserId)
                        .map((m) => {
                          const active = newParticipants.includes(m.user_id);
                          return (
                            <button
                              key={m.user_id}
                              type="button"
                              onClick={() => toggleParticipant(m.user_id)}
                              className={cn(
                                "border px-2 py-0.5 text-[11px] transition-colors",
                                active
                                  ? "border-primary bg-primary/10 text-accent-foreground"
                                  : "border-border text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {m.full_name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </BlueprintBox>

                <BlueprintBox>
                  <BoxKicker>פיד תקשורת ותיעוד</BoxKicker>
                  <ol className="grid gap-3">
                    {activity.map((a) => {
                      const Icon = ACTIVITY_ICONS[a.activity_type];
                      const user = members.find((m) => m.user_id === a.user_id);
                      return (
                        <li
                          key={a.activity_id}
                          id={`activity-${a.activity_id}`}
                          className={cn(
                            "flex gap-2.5 rounded-md",
                            a.activity_id === highlightActivityId && "bg-primary/10 ring-1 ring-primary"
                          )}
                        >
                          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center bg-muted">
                            <Icon className="size-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">{a.content}</p>
                            <p className="text-[11px] text-muted-foreground">
                              [{formatDateTime(a.created_at)}] [{user?.full_name}]
                              {a.participant_ids && a.participant_ids.length > 0 &&
                                ` · עם ${a.participant_ids
                                  .map((id) => members.find((m) => m.user_id === id)?.full_name)
                                  .filter(Boolean)
                                  .join(", ")}`}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                    {activity.length === 0 && (
                      <p className="text-xs text-muted-foreground">אין פעילות מתועדת עדיין.</p>
                    )}
                  </ol>
                </BlueprintBox>
              </TabsContent>

              {/* ── תשלומים ── */}
              <TabsContent value="pay" className="grid gap-3.5">
                <BlueprintBox className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-[11px] uppercase tracking-[.08em] text-muted-foreground">
                          <th className="p-2.5 text-right font-normal">תיאור</th>
                          <th className="p-2.5 text-right font-normal">קטגוריה</th>
                          <th className="p-2.5 text-right font-normal">כמות</th>
                          <th className="p-2.5 text-right font-normal">מחיר ליחידה</th>
                          <th className="p-2.5 text-right font-normal">סה״כ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartLines.map(({ item, quantity, lineTotal }) => (
                          <tr key={item.item_id} className="border-b border-border/60">
                            <td className="p-2.5 font-medium">{item.name}</td>
                            <td className="p-2.5 text-muted-foreground">{CATALOG_UNIT_LABELS[item.unit]}</td>
                            <td className="p-2.5">
                              {item.unit === "fixed" ? (
                                <Input
                                  type="number"
                                  min={0}
                                  value={quantity}
                                  onChange={(e) => setFixedQuantity(item.item_id, Number(e.target.value) || 0)}
                                  className="h-7 w-20 text-sm"
                                />
                              ) : (
                                quantity
                              )}
                            </td>
                            <td className="p-2.5">{formatCurrency(item.price)}</td>
                            <td className="p-2.5 font-medium">{formatCurrency(lineTotal)}</td>
                          </tr>
                        ))}
                        {cartLines.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-muted-foreground">
                              אין פריטים פעילים בקטלוג.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </BlueprintBox>

                <BlueprintBox>
                  <FieldRow label="סה״כ חייב במע״מ">{formatCurrency(cartSubtotal)}</FieldRow>
                  <FieldRow label={`מע״מ (${VAT_PERCENT}%)`}>{formatCurrency(vatAmount)}</FieldRow>
                  <FieldRow label="סה״כ לתשלום">
                    <span className="font-heading text-base font-semibold">{formatCurrency(cartTotal)}</span>
                  </FieldRow>
                  <FieldRow label="התקבל">{formatCurrency(receivedAmount)}</FieldRow>
                  <FieldRow label="יתרה לתשלום">
                    <span
                      className={cn(
                        "font-heading text-base font-semibold",
                        balanceDue > 0 ? "text-destructive" : "text-green-600"
                      )}
                    >
                      {formatCurrency(balanceDue)}
                    </span>
                  </FieldRow>
                  {role !== "office" && (
                    <Button
                      variant="outline"
                      className="mt-3 gap-1.5"
                      onClick={() => router.push(`/billing?leadId=${lead.lead_id}`)}
                    >
                      <FileText className="size-3.5" />
                      הפק הצעת מחיר / חוזה
                    </Button>
                  )}
                </BlueprintBox>

                <BlueprintBox>
                  <BoxKicker>מסמכי הצעה / חוזה</BoxKicker>
                  {financialDocs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">טרם הופקו מסמכים פיננסיים.</p>
                  ) : (
                    <div className="grid gap-1.5">
                      {financialDocs.map((doc) => (
                        <div
                          key={doc.doc_id}
                          className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0"
                        >
                          <FileText className="size-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">{doc.name}</span>
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            {doc.type === "quote" ? "הצעת מחיר" : "חוזה"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </BlueprintBox>
              </TabsContent>

              {/* ── תפריט ── */}
              <TabsContent value="menu" className="grid gap-3.5">
                {MENU_CATEGORIES.map((cat) => (
                  <BlueprintBox key={cat}>
                    <BoxKicker>{cat}</BoxKicker>
                    <p className="text-xs text-muted-foreground">
                      טרם נבחר. התפריט המלא לכל קטגוריה יוגדר ע״י מנהל האולם בהגדרות (בסבב הבא).
                    </p>
                  </BlueprintBox>
                ))}
              </TabsContent>

              {/* ── מסמכים ── */}
              <TabsContent value="docs">
                <BlueprintBox>
                  <BoxKicker>ספריית מסמכים</BoxKicker>
                  {lead.documents.length === 0 && (
                    <p className="text-xs text-muted-foreground">אין מסמכים עדיין.</p>
                  )}
                  <div className="grid gap-1.5">
                    {lead.documents.map((doc) => (
                      <div
                        key={doc.doc_id}
                        className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0"
                      >
                        <Paperclip className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate">{doc.name}</span>
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {doc.type === "quote" ? "הצעת מחיר" : doc.type === "contract" ? "חוזה" : "אחר"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </BlueprintBox>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    <Dialog open={deleteDialogOpen} onOpenChange={(o) => !o && resetDeleteDialog()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>מחיקת כרטיס אירוע</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            פעולה בלתי הפיכה. הזן קוד מחיקה כדי להמשיך.
          </p>
          {deleteLocked ? (
            <div className="grid gap-1.5">
              <Label htmlFor="unlock_pin_input">נעול — הזן קוד שחרור</Label>
              <Input
                id="unlock_pin_input"
                dir="ltr"
                maxLength={4}
                autoFocus
                value={unlockPinInput}
                onChange={(e) => setUnlockPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitUnlockPin())}
              />
              <Button type="button" onClick={submitUnlockPin} className="w-fit">
                שחרר נעילה
              </Button>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="delete_pin_input">קוד מחיקה</Label>
              <Input
                id="delete_pin_input"
                dir="ltr"
                maxLength={4}
                autoFocus
                value={deletePinInput}
                onChange={(e) => setDeletePinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitDeletePin())}
              />
              <p className="text-xs text-muted-foreground">נותרו {deleteAttemptsLeft} ניסיונות</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetDeleteDialog}>
                  ביטול
                </Button>
                <Button type="button" variant="destructive" onClick={submitDeletePin}>
                  מחק לצמיתות
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2 text-[13px] first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-left">{children}</span>
    </div>
  );
}

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-[.06em] text-muted-foreground">{label}</p>
      <div className="truncate text-[13px] font-semibold">{children}</div>
    </div>
  );
}
