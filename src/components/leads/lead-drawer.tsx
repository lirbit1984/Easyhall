"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import type { ActivityType, LeadStatus, PartnerGender } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS, LOST_REASONS, PIPELINE_STAGES, PARTNER_GENDER_LABELS } from "@/lib/types";
import { formatDate, formatDateTime, formatCurrency, waLink, telLink, coupleDisplayName } from "@/lib/format";
import { LeadTaskItem } from "@/components/leads/lead-task-item";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<LeadStatus, string> = {
  potential: "פוטנציאלי",
  closed: "סגור",
  not_relevant: "לא רלוונטי",
};

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
}: {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
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
  const updateLeadStatus = useLeadsStore((s) => s.updateLeadStatus);
  const updateLeadNames = useLeadsStore((s) => s.updateLeadNames);
  const toggleMilestone = useLeadsStore((s) => s.toggleMilestone);
  const setFollowUp = useLeadsStore((s) => s.setFollowUp);
  const setPromises = useLeadsStore((s) => s.setPromises);
  const setFirstInquiry = useLeadsStore((s) => s.setFirstInquiry);
  const setLostReason = useLeadsStore((s) => s.setLostReason);
  const addActivity = useLeadsStore((s) => s.addActivity);
  const allTasks = useLeadsStore((s) => s.tasks);
  const addTask = useLeadsStore((s) => s.addTask);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
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
  const [editP1Name, setEditP1Name] = useState("");
  const [editP2Name, setEditP2Name] = useState("");
  const [editP1Gender, setEditP1Gender] = useState<PartnerGender>("unspecified");
  const [editP2Gender, setEditP2Gender] = useState<PartnerGender>("unspecified");

  if (!lead) return null;

  const startEditingNames = () => {
    setEditP1Name(lead.partner_1_name);
    setEditP2Name(lead.partner_2_name);
    setEditP1Gender(lead.partner_1_gender ?? "unspecified");
    setEditP2Gender(lead.partner_2_gender ?? "unspecified");
    setEditingNames(true);
  };

  const saveNames = () => {
    if (!editP1Name.trim() || !editP2Name.trim()) {
      toast.error("שני השמות הם שדות חובה");
      return;
    }
    updateLeadNames(lead.lead_id, {
      partner_1_name: editP1Name.trim(),
      partner_2_name: editP2Name.trim(),
      partner_1_gender: editP1Gender,
      partner_2_gender: editP2Gender,
    });
    setEditingNames(false);
    toast.success("פרטי הזוג עודכנו");
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

  return (
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
                    <SheetTitle className="sr-only">{coupleDisplayName(lead)}</SheetTitle>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="flex gap-1.5">
                        <Input
                          autoFocus
                          value={editP1Name}
                          onChange={(e) => setEditP1Name(e.target.value)}
                          placeholder="שם בן/בת זוג 1"
                          className="h-8"
                        />
                        <Select
                          value={editP1Gender}
                          onValueChange={(v) => v && setEditP1Gender(v as PartnerGender)}
                        >
                          <SelectTrigger size="sm" className="w-24 shrink-0">
                            <SelectValue>{(v: string) => PARTNER_GENDER_LABELS[v as PartnerGender]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(PARTNER_GENDER_LABELS) as PartnerGender[]).map((g) => (
                              <SelectItem key={g} value={g}>
                                {PARTNER_GENDER_LABELS[g]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          value={editP2Name}
                          onChange={(e) => setEditP2Name(e.target.value)}
                          placeholder="שם בן/בת זוג 2"
                          className="h-8"
                        />
                        <Select
                          value={editP2Gender}
                          onValueChange={(v) => v && setEditP2Gender(v as PartnerGender)}
                        >
                          <SelectTrigger size="sm" className="w-24 shrink-0">
                            <SelectValue>{(v: string) => PARTNER_GENDER_LABELS[v as PartnerGender]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(PARTNER_GENDER_LABELS) as PartnerGender[]).map((g) => (
                              <SelectItem key={g} value={g}>
                                {PARTNER_GENDER_LABELS[g]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                      {coupleDisplayName(lead)}
                    </SheetTitle>
                    {role !== "office" && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={startEditingNames}
                        aria-label="ערוך שמות"
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
                  addActivity(lead.lead_id, "whatsapp", `נשלחה הודעת WhatsApp ל${lead.partner_1_name}.`);
                  window.open(
                    waLink(lead.phone_primary, `שלום ${lead.partner_1_name}, `),
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
              <TabsTrigger value="comm" className="flex-none px-4 py-2.5">תקשורת</TabsTrigger>
              <TabsTrigger value="docs" className="flex-none px-4 py-2.5">מסמכים</TabsTrigger>
              <TabsTrigger value="pay" className="flex-none px-4 py-2.5">תשלומים</TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {/* ── סקירה ── */}
              <TabsContent value="overview" className="grid gap-3.5">
                <div className="grid gap-3.5 lg:grid-cols-[1fr_1.4fr]">
                  <BlueprintBox>
                    <BoxKicker>פרטי קשר</BoxKicker>
                    <FieldRow label="טלפון">
                      <a href={telLink(lead.phone_primary)} className="hover:underline">
                        {lead.phone_primary}
                      </a>
                    </FieldRow>
                    {lead.phone_secondary && (
                      <FieldRow label="טלפון נוסף">
                        <a href={telLink(lead.phone_secondary)} className="hover:underline">
                          {lead.phone_secondary}
                        </a>
                      </FieldRow>
                    )}
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
                        className="h-8 gap-1"
                        disabled={!newTaskTitle.trim() || !newTaskDue}
                        onClick={submitTask}
                      >
                        <Plus className="size-3.5" />
                        הוסף מטלה
                      </Button>
                    </div>
                  </div>
                </BlueprintBox>
              </TabsContent>

              {/* ── תקשורת ── */}
              <TabsContent value="comm" className="grid gap-3.5">
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
                        <li key={a.activity_id} className="flex gap-2.5">
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

              {/* ── תשלומים ── */}
              <TabsContent value="pay" className="grid gap-3.5">
                <BlueprintBox>
                  <BoxKicker>סיכום פיננסי</BoxKicker>
                  <FieldRow label="מוזמנים משוערים">{lead.estimated_guests}</FieldRow>
                  <FieldRow label="מחיר מנה">{formatCurrency(lead.price_per_plate)}</FieldRow>
                  <FieldRow label="שווי חוזה משוער">
                    <span className="font-heading text-base font-semibold">
                      {formatCurrency(contractValue)}
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
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
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
