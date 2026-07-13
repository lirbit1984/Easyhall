"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageCircle,
  FileText,
  Phone,
  Mail,
  Users,
  CalendarDays,
  Utensils,
  Paperclip,
  Send,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
  StickyNote,
  RefreshCcw,
  ListChecks,
  Plus,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { RepAvatar } from "@/components/leads/rep-avatar";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import type { ActivityType, LeadStatus } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types";
import { formatDate, formatDateTime, formatCurrency, waLink, telLink } from "@/lib/format";
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
  whatsapp: MessageCircle,
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
  const toggleMilestone = useLeadsStore((s) => s.toggleMilestone);
  const setFollowUp = useLeadsStore((s) => s.setFollowUp);
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
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  if (!lead) return null;

  const submitActivity = () => {
    if (!newContent.trim()) return;
    addActivity(lead.lead_id, newType, newContent.trim());
    setNewContent("");
    toast.success("הפעולה תועדה בפיד התקשורת");
  };

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

  return (
    <Sheet open={!!leadId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full! sm:max-w-3xl! p-0 overflow-hidden"
      >
        <div className="flex h-full w-full flex-col overflow-hidden">
          {/* Header */}
          <SheetHeader className="border-b bg-muted/40 pb-4">
            <div className="flex items-start justify-between gap-3 pl-8">
              <div>
                <SheetTitle className="text-lg">
                  {lead.partner_1_name} & {lead.partner_2_name}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <RepAvatar userId={lead.assigned_user_id} size="sm" />
                  {members.find((m) => m.user_id === lead.assigned_user_id)?.full_name} · מקור: {lead.lead_source}
                </SheetDescription>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
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
                <MessageCircle className="size-3.5 text-green-600" />
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

          {/* Body: 2 columns on desktop, stacked on mobile */}
          <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            {/* עמודת פרטים ואבני דרך - שמאל */}
            <div className="order-2 shrink-0 overflow-y-auto p-4 lg:w-[45%] lg:border-l">
              <section className="grid gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground">פרטי התקשרות</h4>
                <a
                  href={telLink(lead.phone_primary)}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Phone className="size-3.5 text-muted-foreground" />
                  {lead.phone_primary}
                </a>
                {lead.phone_secondary && (
                  <a
                    href={telLink(lead.phone_secondary)}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Phone className="size-3.5 text-muted-foreground" />
                    {lead.phone_secondary}
                  </a>
                )}
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Mail className="size-3.5 text-muted-foreground" />
                    {lead.email}
                  </a>
                )}
              </section>

              <Separator className="my-4" />

              <section className="grid gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground">פרטי אירוע</h4>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  תאריך אירוע: {formatDate(lead.event_date)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-3.5 text-muted-foreground" />
                  {lead.estimated_guests} מוזמנים משוערים
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Utensils className="size-3.5 text-muted-foreground" />
                  מחיר מנה: {formatCurrency(lead.price_per_plate)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-3.5 text-muted-foreground" />
                  פולו-אפ הבא: {lead.follow_up_at ? formatDateTime(lead.follow_up_at) : "לא נקבע"}
                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={scheduleFollowUpTomorrow}>
                    תזמן למחר
                  </Button>
                </div>
              </section>

              <Separator className="my-4" />

              <section className="grid gap-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground">אבני דרך (Milestones)</h4>
                {lead.milestones.map((m) => (
                  <label
                    key={m.key}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/60"
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
              </section>

              <Separator className="my-4" />

              <section className="grid gap-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <ListChecks className="size-3.5" />
                  משימות לליד זה
                </h4>

                {leadTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground">אין משימות פתוחות לליד זה.</p>
                )}

                <ul className="grid gap-1">
                  {leadTasks.map((t) => (
                    <LeadTaskItem key={t.task_id} task={t} />
                  ))}
                </ul>

                <div className="mt-1 grid gap-1.5 rounded-md border border-dashed p-2">
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
              </section>

              <Separator className="my-4" />

              <section className="grid gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground">ספריית מסמכים</h4>
                {lead.documents.length === 0 && (
                  <p className="text-xs text-muted-foreground">אין מסמכים עדיין.</p>
                )}
                {lead.documents.map((doc) => (
                  <div key={doc.doc_id} className="flex items-center gap-2 text-sm">
                    <Paperclip className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{doc.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {doc.type === "quote" ? "הצעת מחיר" : doc.type === "contract" ? "חוזה" : "אחר"}
                    </Badge>
                  </div>
                ))}
              </section>
            </div>

            {/* עמודת פיד תקשורת - ימין */}
            <div className="order-1 flex flex-1 flex-col overflow-y-auto p-4 lg:overflow-hidden">
              <div className="mb-3 grid gap-2">
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
              </div>

              <Separator className="mb-3" />

              <div className="flex-1 overflow-y-auto">
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                  פיד תקשורת ותיעוד
                </h4>
                <ol className="grid gap-3">
                  {activity.map((a) => {
                    const Icon = ACTIVITY_ICONS[a.activity_type];
                    const user = members.find((m) => m.user_id === a.user_id);
                    return (
                      <li key={a.activity_id} className="flex gap-2.5">
                        <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Icon className="size-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{a.content}</p>
                          <p className="text-[11px] text-muted-foreground">
                            [{formatDateTime(a.created_at)}] [{user?.full_name}]
                          </p>
                        </div>
                      </li>
                    );
                  })}
                  {activity.length === 0 && (
                    <p className="text-xs text-muted-foreground">אין פעילות מתועדת עדיין.</p>
                  )}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
