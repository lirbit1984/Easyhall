"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Users,
  Paperclip,
  PhoneIncoming,
  PhoneOutgoing,
  StickyNote,
  RefreshCcw,
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
  Phone,
  MessageSquare,
  Mail,
  Maximize2,
  MoreVertical,
  Camera,
  Lock,
  Unlock,
  Upload,
  FolderOpen,
  Share2,
  Send,
  Link as LinkIcon,
  Printer,
  ClipboardList,
} from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { storage, functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { EventTypeIcon } from "@/components/event-type-icon";
import { elementToPdfBlob } from "@/lib/generate-pdf";
import { printElement } from "@/lib/print";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { LeadTaskItem } from "@/components/leads/lead-task-item";
import { CartQuoteDialog, type QuoteItem } from "@/components/leads/cart-quote-dialog";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { PickOrgFileDialog } from "@/components/leads/pick-org-file-dialog";
import { EventPlanningTab } from "@/components/leads/event-planning-tab";
import { useCanEditPlanning } from "@/lib/firebase/use-can-edit-planning";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import type {
  ActivityType,
  LeadStatus,
  EventContact,
  EventContactRole,
  Task,
  MeetingType,
  MenuServingStyle,
  MenuCategory,
  MenuDish,
  DocumentRef,
  OrgFile,
} from "@/lib/types";
import {
  ACTIVITY_TYPE_LABELS,
  LOST_REASONS,
  getRoleLabel,
  EVENT_CONTACT_ROLE_LABELS,
  STATUS_LABELS,
  MEETING_TYPE_LABELS,
  CLOSED_ONLY_MEETING_TYPES,
  MEETING_TYPE_COLORS,
  getMeetingEffectiveState,
  isSystemActivity,
  MENU_SERVING_STYLE_LABELS,
  EVENT_DAY_PART_LABELS,
  MENU_CATEGORIES,
  DEFAULT_MENU_CATEGORY_LIMIT,
} from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatWeekday,
  formatMonth,
  waLink,
  telLink,
  smsLink,
  mailLink,
  gmailComposeLink,
  getEventTitle,
  primaryPhone,
  primaryEmail,
  primaryContactName,
} from "@/lib/format";
import { createShortLink } from "@/lib/short-link";
import { openBlankTab, navigateTab } from "@/lib/open-tab";
import { cn } from "@/lib/utils";

const DEFAULT_VAT_PERCENT = 18;
const DEFAULT_DEPOSIT_PERCENT = 20;

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
  initialTab,
}: {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
  highlightActivityId?: string | null;
  initialTab?: "overview" | "pay" | "menu" | "docs";
}) {
  const lead = useLeadsStore((s) => s.leads.find((l) => l.lead_id === leadId));
  const allActivity = useLeadsStore((s) => s.activity);
  const activity = useMemo(
    () =>
      allActivity
        .filter((a) => a.lead_id === leadId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allActivity, leadId]
  );
  // תיעוד שהנציג הקליד מול רישומים שהמערכת יצרה (שליחות, עדכוני פרטים,
  // שינויי סטטוס) — מופרדים לשני טאבים כדי שהתיעוד האנושי לא ייבלע ברעש.
  const manualActivity = useMemo(() => activity.filter((a) => !isSystemActivity(a)), [activity]);
  const systemActivity = useMemo(() => activity.filter((a) => isSystemActivity(a)), [activity]);
  const [activityTab, setActivityTab] = useState<"manual" | "system">("manual");

  // הגעה לרשומה מקושרת מבחוץ חייבת לפתוח את הטאב שהיא יושבת בו, אחרת
  // ה-scrollIntoView מחפש אלמנט שלא מרונדר.
  useEffect(() => {
    if (!highlightActivityId) return;
    const target = activity.find((a) => a.activity_id === highlightActivityId);
    if (!target) return;
    Promise.resolve().then(() => setActivityTab(isSystemActivity(target) ? "system" : "manual"));
  }, [highlightActivityId, activity]);

  useEffect(() => {
    if (!highlightActivityId) return;
    const el = document.getElementById(`activity-${highlightActivityId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightActivityId, leadId, activityTab]);

  const updateLeadStatus = useLeadsStore((s) => s.updateLeadStatus);
  const closeLeadEvent = useLeadsStore((s) => s.closeLeadEvent);
  const updateLeadContacts = useLeadsStore((s) => s.updateLeadContacts);
  const updateLeadSchedule = useLeadsStore((s) => s.updateLeadSchedule);
  const updateLeadGuests = useLeadsStore((s) => s.updateLeadGuests);
  const syncLeadCalendar = useLeadsStore((s) => s.syncLeadCalendar);

  // תיקון רטרואקטיבי: לידים שנסגרו לפני שהסנכרון האוטומטי ליומן נוסף לא
  // קיבלו רשומת calendarEvent — מסנכרן בכל פתיחה של הכרטיס.
  useEffect(() => {
    if (leadId) syncLeadCalendar(leadId);
  }, [leadId, syncLeadCalendar]);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const allCatalog = useLeadsStore((s) => s.catalog);
  const catalog = useMemo(() => allCatalog.filter((c) => c.active), [allCatalog]);
  const allCatalogBundles = useLeadsStore((s) => s.catalogBundles);
  const catalogBundles = useMemo(() => allCatalogBundles.filter((b) => b.active), [allCatalogBundles]);
  const toggleMilestone = useLeadsStore((s) => s.toggleMilestone);
  const addCartItems = useLeadsStore((s) => s.addCartItems);
  const updateCartLine = useLeadsStore((s) => s.updateCartLine);
  const removeCartItem = useLeadsStore((s) => s.removeCartItem);
  const setCartLocked = useLeadsStore((s) => s.setCartLocked);
  const setLeadDepositOverride = useLeadsStore((s) => s.setLeadDepositOverride);
  const renameDocument = useLeadsStore((s) => s.renameDocument);
  const deleteDocument = useLeadsStore((s) => s.deleteDocument);
  const addDocument = useLeadsStore((s) => s.addDocument);
  const setDocumentShortUrl = useLeadsStore((s) => s.setDocumentShortUrl);
  const setPromises = useLeadsStore((s) => s.setPromises);
  const addMeeting = useLeadsStore((s) => s.addMeeting);
  const cancelMeeting = useLeadsStore((s) => s.cancelMeeting);
  const deleteMeeting = useLeadsStore((s) => s.deleteMeeting);
  const setLostReason = useLeadsStore((s) => s.setLostReason);
  const addActivity = useLeadsStore((s) => s.addActivity);
  const addSystemActivity = useLeadsStore((s) => s.addSystemActivity);
  const canEditPlanning = useCanEditPlanning();
  const updateActivity = useLeadsStore((s) => s.updateActivity);
  const deleteActivity = useLeadsStore((s) => s.deleteActivity);
  const allTasks = useLeadsStore((s) => s.tasks);
  const deleteLead = useLeadsStore((s) => s.deleteLead);
  const deletePin = useLeadsStore((s) => s.deletePin);
  const deleteUnlockPin = useLeadsStore((s) => s.deleteUnlockPin);
  const { members } = useOrgMembers();
  const role = useCurrentRole();
  const { orgDoc } = useOrgDoc();
  const orgId = useLeadsStore((s) => s.orgId);
  const updateLeadPhoto = useLeadsStore((s) => s.updateLeadPhoto);
  const menuDishes = useLeadsStore((s) => s.menuDishes);
  const updateLeadMenuSelection = useLeadsStore((s) => s.updateLeadMenuSelection);
  const setLeadMenuDishNote = useLeadsStore((s) => s.setLeadMenuDishNote);
  const setLeadMenuLocked = useLeadsStore((s) => s.setLeadMenuLocked);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [generatingMenuPdf, setGeneratingMenuPdf] = useState(false);
  const [menuNoteOpenFor, setMenuNoteOpenFor] = useState<string | null>(null);
  const [menuNoteDraft, setMenuNoteDraft] = useState("");
  const menuPreviewRef = useRef<HTMLDivElement>(null);
  const [pickOrgFileOpen, setPickOrgFileOpen] = useState(false);
  const [sendingDocId, setSendingDocId] = useState<string | null>(null);
  const leadTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.lead_id === leadId)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [allTasks, leadId]
  );
  const leadOpenTasks = leadTasks.filter((t) => !t.is_completed);
  const leadDoneTasks = leadTasks.filter((t) => t.is_completed);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<EventContact>({
    contact_id: "",
    role_key: "guest",
    name: "",
  });
  const [deleteContactTarget, setDeleteContactTarget] = useState<string | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const [statusPinDialogOpen, setStatusPinDialogOpen] = useState(false);
  const [statusPinInput, setStatusPinInput] = useState("");
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);
  const [statusConfirmDialogOpen, setStatusConfirmDialogOpen] = useState(false);
  const [notRelevantDialogOpen, setNotRelevantDialogOpen] = useState(false);
  const [lostReasonDraft, setLostReasonDraft] = useState("");

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [expandedTaskTab, setExpandedTaskTab] = useState<"open" | "done">("open");

  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<ActivityType>("note");
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingActivityContent, setEditingActivityContent] = useState("");
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<string | null>(null);

  const [promisesDialogOpen, setPromisesDialogOpen] = useState(false);
  const [promisesDraft, setPromisesDraft] = useState("");

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");

  const [guestsDialogOpen, setGuestsDialogOpen] = useState(false);
  const [guestsDraft, setGuestsDraft] = useState("");

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

  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingTypeDraft, setMeetingTypeDraft] = useState<MeetingType>("first");
  const [meetingDateDraft, setMeetingDateDraft] = useState("");
  const [meetingTimeDraft, setMeetingTimeDraft] = useState("");
  const [meetingNotesDraft, setMeetingNotesDraft] = useState("");
  const [meetingCancelTarget, setMeetingCancelTarget] = useState<string | null>(null);
  const [meetingDeleteTarget, setMeetingDeleteTarget] = useState<string | null>(null);
  const [meetingDeletePinInput, setMeetingDeletePinInput] = useState("");
  const [viewMeetingId, setViewMeetingId] = useState<string | null>(null);
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);

  const [closeEventDialogOpen, setCloseEventDialogOpen] = useState(false);
  const [closeDateDraft, setCloseDateDraft] = useState("");
  const [closeStartDraft, setCloseStartDraft] = useState("");
  const [closeEndDraft, setCloseEndDraft] = useState("");
  const [closeDayPartDraft, setCloseDayPartDraft] = useState<"morning" | "evening">("evening");
  const [closeGuestsDraft, setCloseGuestsDraft] = useState("");
  const [closeServingStyleDraft, setCloseServingStyleDraft] = useState<MenuServingStyle | "">("");

  const [cartPickerOpen, setCartPickerOpen] = useState(false);
  const [cartPickerSelection, setCartPickerSelection] = useState<string[]>([]);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteDocType, setQuoteDocType] = useState<"quote" | "contract">("quote");
  const [viewingDoc, setViewingDoc] = useState<{ name: string; url: string } | null>(null);
  const [docRenameTarget, setDocRenameTarget] = useState<string | null>(null);
  const [docRenameDraft, setDocRenameDraft] = useState("");
  const [docDeleteTarget, setDocDeleteTarget] = useState<string | null>(null);
  const [depositOverrideEditing, setDepositOverrideEditing] = useState(false);
  const [depositOverrideModeDraft, setDepositOverrideModeDraft] = useState<"percent" | "fixed">("percent");
  const [depositOverrideValueDraft, setDepositOverrideValueDraft] = useState("");

  const openMeetingDialog = () => {
    setMeetingTypeDraft("first");
    setMeetingDateDraft("");
    setMeetingTimeDraft("");
    setMeetingNotesDraft("");
    setMeetingSubmitting(false);
    setMeetingDialogOpen(true);
  };

  const saveMeeting = () => {
    if (meetingSubmitting || !lead) return;
    setMeetingSubmitting(true);
    addMeeting(lead.lead_id, meetingTypeDraft, meetingDateDraft || null, meetingTimeDraft || null, meetingNotesDraft);
    setMeetingDialogOpen(false);
    toast.success("הפגישה נוספה");
  };

  const confirmCancelMeeting = () => {
    if (!lead || !meetingCancelTarget) return;
    cancelMeeting(lead.lead_id, meetingCancelTarget);
    setMeetingCancelTarget(null);
    setViewMeetingId(null);
    toast.success("הפגישה בוטלה");
  };

  const submitMeetingDeletePin = () => {
    if (!lead || !meetingDeleteTarget) return;
    if (meetingDeletePinInput === deletePin) {
      deleteMeeting(lead.lead_id, meetingDeleteTarget);
      toast.success("הפגישה נמחקה");
      setMeetingDeleteTarget(null);
      setMeetingDeletePinInput("");
      setViewMeetingId(null);
    } else {
      setMeetingDeletePinInput("");
      toast.error("קוד שגוי");
    }
  };

  if (!lead) return null;

  const eventType = eventTypes.find((t) => t.event_type_id === lead.event_type_id);
  const availableRoles = eventType?.role_keys ?? [];

  const startEditingTitle = () => {
    setTitleDraft(lead.custom_title ?? "");
    setEditingTitle(true);
  };

  const saveTitle = () => {
    updateLeadContacts(lead.lead_id, lead.contacts ?? [], titleDraft.trim() || null);
    setEditingTitle(false);
    toast.success("הכותרת עודכנה");
  };

  const openAddContact = () => {
    setContactDraft({ contact_id: "", role_key: availableRoles[0] ?? "guest", name: "" });
    setContactDialogOpen(true);
  };

  const openEditContact = (contact: EventContact) => {
    setContactDraft({ ...contact });
    setContactDialogOpen(true);
  };

  const saveContact = () => {
    if (!contactDraft.name.trim()) {
      toast.error("יש להזין שם");
      return;
    }
    const existing = lead.contacts ?? [];
    const isNew = !contactDraft.contact_id;
    const nextContacts = isNew
      ? [...existing, { ...contactDraft, contact_id: `c${Date.now()}` }]
      : existing.map((c) => (c.contact_id === contactDraft.contact_id ? { ...contactDraft } : c));
    updateLeadContacts(lead.lead_id, nextContacts, lead.custom_title ?? null);
    setContactDialogOpen(false);
    toast.success(isNew ? "איש הקשר נוסף" : "איש הקשר עודכן");
  };

  const confirmDeleteContact = () => {
    if (!deleteContactTarget) return;
    const nextContacts = (lead.contacts ?? []).filter((c) => c.contact_id !== deleteContactTarget);
    updateLeadContacts(lead.lead_id, nextContacts, lead.custom_title ?? null);
    setDeleteContactTarget(null);
    toast.success("איש הקשר הוסר");
  };

  const submitActivity = () => {
    if (!newContent.trim()) return;
    addActivity(lead.lead_id, newType, newContent.trim());
    setNewContent("");
    setNewType("note");
    setActivityDialogOpen(false);
    toast.success("הפעולה תועדה בפיד התקשורת");
  };

  const startEditActivity = (activityId: string, content: string) => {
    setEditingActivityId(activityId);
    setEditingActivityContent(content);
  };

  const saveActivityEdit = () => {
    if (!editingActivityId || !editingActivityContent.trim()) return;
    updateActivity(editingActivityId, editingActivityContent.trim());
    setEditingActivityId(null);
    setEditingActivityContent("");
    toast.success("התיעוד עודכן");
  };

  const confirmDeleteActivity = () => {
    if (!deleteActivityTarget) return;
    deleteActivity(deleteActivityTarget);
    setDeleteActivityTarget(null);
    toast.success("התיעוד נמחק");
  };

  const openPromisesDialog = () => {
    setPromisesDraft(lead.promises ?? "");
    setPromisesDialogOpen(true);
  };

  const savePromises = () => {
    setPromises(lead.lead_id, promisesDraft);
    setPromisesDialogOpen(false);
    toast.success("ההבטחות נשמרו");
  };

  const deletePromises = () => {
    setPromises(lead.lead_id, "");
    setPromisesDialogOpen(false);
    toast.success("ההבטחות נמחקו");
  };

  const openScheduleDialog = () => {
    setScheduleDate(lead.event_date ? lead.event_date.slice(0, 10) : "");
    setScheduleStart(lead.event_start_time ?? "");
    setScheduleEnd(lead.event_end_time ?? "");
    setScheduleDialogOpen(true);
  };

  const saveSchedule = () => {
    updateLeadSchedule(lead.lead_id, {
      event_date: scheduleDate ? new Date(scheduleDate).toISOString() : null,
      event_start_time: scheduleStart || undefined,
      event_end_time: scheduleEnd || undefined,
    });
    setScheduleDialogOpen(false);
    toast.success("תאריך ושעות האירוע עודכנו");
  };

  const openGuestsDialog = () => {
    setGuestsDraft(String(lead.estimated_guests));
    setGuestsDialogOpen(true);
  };

  const saveGuests = () => {
    const n = Number(guestsDraft);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("מספר לא תקין");
      return;
    }
    updateLeadGuests(lead.lead_id, n);
    setGuestsDialogOpen(false);
    toast.success("מספר המוזמנים עודכן");
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isFirebaseConfigured || !storage || !orgId) return;
    setUploadingPhoto(true);
    try {
      const path = `organizations/${orgId}/leads/${lead.lead_id}/photo/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      updateLeadPhoto(lead.lead_id, url);
      toast.success("התמונה הועלתה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת התמונה");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isFirebaseConfigured || !storage || !orgId) return;
    setUploadingDoc(true);
    try {
      const path = `organizations/${orgId}/leads/${lead.lead_id}/documents/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      addDocument(lead.lead_id, { name: file.name, type: "other", url });
      toast.success("הקובץ הועלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleGenerateMenuPdf = async () => {
    setGeneratingMenuPdf(true);
    try {
      await new Promise((r) => setTimeout(r, 60));
      if (!menuPreviewRef.current) throw new Error("התצוגה המקדימה לא מוכנה");
      const docName = `תפריט האירוע - ${getEventTitle(lead, eventType)}.pdf`;
      const blob = await elementToPdfBlob(menuPreviewRef.current);
      if (isFirebaseConfigured && storage && orgId) {
        // event-handler-only path (identical to the same pattern used safely
        // elsewhere in this codebase) — eslint-plugin-react-hooks's purity
        // check flags it here regardless.
        // eslint-disable-next-line react-hooks/purity
        const path = `organizations/${orgId}/leads/${lead.lead_id}/documents/${Date.now()}-${docName}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, blob, { contentType: "application/pdf" });
        const url = await getDownloadURL(fileRef);
        addDocument(lead.lead_id, { name: docName, type: "other", url });
        toast.success("התפריט נשמר בטאב המסמכים — משם אפשר לשתף");
      } else {
        const localUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = localUrl;
        a.download = docName;
        a.click();
        URL.revokeObjectURL(localUrl);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "הפקת התפריט נכשלה");
    } finally {
      setGeneratingMenuPdf(false);
    }
  };

  const handlePrintMenu = () => {
    if (!menuPreviewRef.current) return;
    printElement(menuPreviewRef.current, `תפריט האירוע - ${getEventTitle(lead, eventType)}`);
  };

  const openMenuNote = (dishId: string) => {
    setMenuNoteOpenFor(dishId);
    setMenuNoteDraft(lead.menu_selection_notes?.[dishId] ?? "");
  };

  const saveMenuNote = () => {
    if (menuNoteOpenFor) setLeadMenuDishNote(lead.lead_id, menuNoteOpenFor, menuNoteDraft.trim());
    setMenuNoteOpenFor(null);
  };

  // צירוף מהמאגר הארגוני: שומרים הפניה לאותה כתובת ב-Storage במקום להעתיק את
  // הקובץ, כך שהחלפה במאגר משתקפת בכל הלידים שצורף אליהם.
  const handlePickOrgFile = (file: OrgFile) => {
    addDocument(lead.lead_id, { name: file.name, type: "other", url: file.url });
    toast.success(`"${file.name}" צורף לכרטיס`);
  };

  /**
   * מחזיר את הכתובת שנשלחת לזוג: קישור קצר (/f/{code}) במקום כתובת ההורדה
   * הענקית של Storage. נוצר פעם אחת בשיתוף הראשון ונשמר על המסמך, כך שכל
   * שיתוף חוזר של אותו מסמך משתמש באותו קישור. אם היצירה נכשלת נופלים חזרה
   * לכתובת המקורית — עדיף קישור מכוער מאשר שיתוף שלא עובד.
   */
  const shareUrlFor = async (docRef: DocumentRef): Promise<string> => {
    if (docRef.short_url) return docRef.short_url;
    if (!orgId) return docRef.url;
    try {
      const short = await createShortLink(orgId, docRef.url, docRef.name);
      setDocumentShortUrl(lead.lead_id, docRef.doc_id, short);
      return short;
    } catch {
      return docRef.url;
    }
  };

  const handleShareWhatsApp = async (docRef: DocumentRef) => {
    const win = openBlankTab();
    const url = await shareUrlFor(docRef);
    const target = waLink(primaryPhone(lead), `שלום ${primaryContactName(lead)}, מצורף "${docRef.name}".\n${url}`);
    navigateTab(win, target);
    addSystemActivity(lead.lead_id, "whatsapp", `נשלח מסמך "${docRef.name}" ב-WhatsApp ל${primaryContactName(lead)}.`);
  };

  /**
   * שליחה מהשרת: המייל יוצא בשם האולם דרך Resend, בלי תלות בתוכנת הדואר או
   * בחשבון הגוגל של הנציג. דורש דומיין מאומת — עד שהוא מוגדר הפונקציה מחזירה
   * failed-precondition, ולכן שאר אפשרויות השיתוף נשארות בתפריט.
   */
  const handleSendFromSystem = async (docRef: DocumentRef) => {
    if (!isFirebaseConfigured || !functions || !orgId) {
      toast.error("שליחה מהמערכת זמינה רק כשהמערכת מחוברת ל-Firebase");
      return;
    }
    setSendingDocId(docRef.doc_id);
    try {
      // הקישור הקצר נוצר בצד הלקוח כדי שהמייל יישא אותו ולא את הכתובת הארוכה.
      await shareUrlFor(docRef);
      const sendDocumentEmail = httpsCallable(functions, "sendDocumentEmail");
      const res = await sendDocumentEmail({ orgId, leadId: lead.lead_id, docId: docRef.doc_id });
      const recipient = (res.data as { recipient?: string })?.recipient;
      toast.success(recipient ? `המסמך נשלח ל-${recipient}` : "המסמך נשלח");
    } catch (err) {
      // עד שהדומיין מאומת והפונקציה נפרסת, הקריאה נכשלת ב-not-found/internal —
      // מציגים הסבר במקום קוד שגיאה, ושאר אפשרויות השיתוף נשארות זמינות.
      const message = err instanceof Error ? err.message : "";
      toast.error(
        /not-?found|internal/i.test(message)
          ? "שליחה מהמערכת עדיין לא הופעלה. בינתיים אפשר לשתף ב-Gmail או להעתיק קישור."
          : message || "שליחת המייל נכשלה"
      );
    } finally {
      setSendingDocId(null);
    }
  };

  const handleShareEmail = async (docRef: DocumentRef, via: "client" | "gmail") => {
    const email = primaryEmail(lead);
    if (!email) {
      toast.error("לא נמצאה כתובת מייל לזוג");
      return;
    }
    const win = via === "gmail" ? openBlankTab() : null;
    const url = await shareUrlFor(docRef);
    const subject = docRef.name;
    const body = `שלום ${primaryContactName(lead)},\n\nמצורף קישור למסמך "${docRef.name}":\n${url}`;

    if (via === "gmail") {
      navigateTab(win, gmailComposeLink(email, subject, body, orgDoc?.senderEmail));
    } else {
      // location.href ולא window.open: כרטיסייה חדשה עם mailto נחסמת/נשארת
      // ריקה ברוב הדפדפנים, ואז לא קורה כלום. ניווט בחלון הנוכחי מעביר את
      // הכתובת למטפל הדואר של המערכת ומשאיר את הדף פתוח.
      window.location.href = mailLink(email, subject, body);
    }
    addSystemActivity(lead.lead_id, "note", `נשלח מסמך "${docRef.name}" במייל ל${primaryContactName(lead)}.`);
  };

  const handleCopyLink = async (docRef: DocumentRef) => {
    try {
      await navigator.clipboard.writeText(await shareUrlFor(docRef));
      toast.success("הקישור הועתק");
    } catch {
      toast.error("לא ניתן היה להעתיק את הקישור");
    }
  };

  const applyStatusChange = (status: LeadStatus) => {
    updateLeadStatus(lead.lead_id, status);
    if (status === "closed" && !lead.event_date) {
      openScheduleDialog();
    }
  };

  const handleStatusChange = (status: LeadStatus) => {
    if (lead.status === "closed" && status !== "closed") {
      setPendingStatus(status);
      if (role === "admin") {
        setStatusConfirmDialogOpen(true);
      } else {
        setStatusPinInput("");
        setStatusPinDialogOpen(true);
      }
      return;
    }
    if (status === "closed" && lead.status !== "closed") {
      openCloseEventDialog();
      return;
    }
    // סימון כ"לא רלוונטי" מוציא את הכרטיס מהלידים הפעילים, ולכן נדרש אישור — וסיבת
    // האובדן נאספת באותו מסך במקום להישאר שדה שנציג עלול לדלג עליו.
    if (status === "not_relevant" && lead.status !== "not_relevant") {
      setLostReasonDraft(lead.lost_reason ?? "");
      setNotRelevantDialogOpen(true);
      return;
    }
    applyStatusChange(status);
  };

  const confirmNotRelevant = () => {
    if (!lostReasonDraft) return;
    applyStatusChange("not_relevant");
    setLostReason(lead.lead_id, lostReasonDraft);
    setNotRelevantDialogOpen(false);
  };

  const openCloseEventDialog = () => {
    setCloseDateDraft(lead.event_date ?? "");
    setCloseStartDraft(lead.event_start_time ?? "");
    setCloseEndDraft(lead.event_end_time ?? "");
    setCloseDayPartDraft(lead.event_day_part ?? "evening");
    setCloseGuestsDraft(lead.estimated_guests ? String(lead.estimated_guests) : "");
    setCloseServingStyleDraft(lead.serving_style ?? "");
    setCloseEventDialogOpen(true);
  };

  const closeEventFormValid =
    !!closeDateDraft && !!closeStartDraft && !!closeEndDraft && !!closeServingStyleDraft && Number(closeGuestsDraft) > 0;

  const confirmCloseEvent = () => {
    if (!closeEventFormValid) return;
    closeLeadEvent(lead.lead_id, {
      event_date: closeDateDraft,
      event_start_time: closeStartDraft,
      event_end_time: closeEndDraft,
      event_day_part: closeDayPartDraft,
      estimated_guests: Number(closeGuestsDraft),
      serving_style: closeServingStyleDraft as MenuServingStyle,
    });
    setCloseEventDialogOpen(false);
    toast.success("האירוע נסגר ופרטיו אושרו");
  };

  const confirmStatusChangeAsAdmin = () => {
    if (pendingStatus) applyStatusChange(pendingStatus);
    setStatusConfirmDialogOpen(false);
    setPendingStatus(null);
  };

  const submitStatusPin = () => {
    if (statusPinInput !== deletePin) {
      toast.error("קוד שגוי");
      setStatusPinInput("");
      return;
    }
    if (pendingStatus) applyStatusChange(pendingStatus);
    setStatusPinDialogOpen(false);
    setPendingStatus(null);
    setStatusPinInput("");
  };

  const repName = members.find((m) => m.user_id === lead.assigned_user_id)?.full_name;
  const financialDocs = lead.documents.filter(
    (d) => d.type === "quote" || d.type === "contract"
  );
  const venueName = orgDoc?.name ?? "—";
  const depositPaid = lead.milestones.find((m) => m.key === "deposit_paid")?.done ?? false;

  // עגלת התשלומים: רק פריטים שנוספו בפועל ל-lead.cart מוצגים ומחושבים (לא כל
  // הקטלוג). כמות ומחיר ניתנים לעריכה חופשית לכל שורה, גם עבור per_guest.
  // vatPercent ניתן להגדרה ברמת הארגון (הגדרות > מאגר פריטים), עם נפילה
  // חזרה ל-DEFAULT_VAT_PERCENT לארגונים ותיקים.
  const vatPercent = orgDoc?.vatPercent ?? DEFAULT_VAT_PERCENT;
  const cartLocked = lead.cart_locked ?? false;
  const cartLines = (lead.cart ?? [])
    .map((line) => {
      const item = allCatalog.find((c) => c.item_id === line.item_id);
      if (!item) return null;
      const unitPrice = line.price_override ?? item.price;
      const lineSubtotal = unitPrice * line.quantity;
      const vatMode = line.vat_mode ?? "plus_vat";
      const lineVat =
        vatMode === "included"
          ? lineSubtotal * (vatPercent / (100 + vatPercent))
          : lineSubtotal * (vatPercent / 100);
      const lineTotal = vatMode === "included" ? lineSubtotal : lineSubtotal + lineVat;
      return { line, item, unitPrice, vatMode, lineSubtotal, lineVat, lineTotal };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
  const availableCatalog = catalog.filter((c) => !(lead.cart ?? []).some((line) => line.item_id === c.item_id));

  // תפריט: כמו cart_locked — "שמירת התפריט" נועלת לתצוגת סיכום בלבד;
  // "עריכה" משחררת בחזרה לבחירה המלאה. מנה שהושבתה במאגר (active:false)
  // מוצגת רק אם היא כבר נבחרה כאן, כך שאפשר תמיד להסיר אותה.
  const menuLocked = lead.menu_locked ?? false;
  const menuIsAdmin = role === "admin";
  const menuByCategory = MENU_CATEGORIES.map((cat) => {
    const limit = orgDoc?.menuCategoryLimits?.[cat] ?? DEFAULT_MENU_CATEGORY_LIMIT;
    const selectedIds = lead.menu_selection?.[cat] ?? [];
    const dishes = menuDishes.filter((d) => d.category === cat && (d.active !== false || selectedIds.includes(d.dish_id)));
    // מנות שנמחקו סופית מהמאגר (מלפני שהמחיקה הפכה ל"השבתה") — אין להן
    // רשומה בכלל, אבל ה-ID עדיין תקוע בבחירה. מוצגות כשורת placeholder
    // גנרית כדי שאפשר יהיה להסיר אותן.
    const orphanIds = selectedIds.filter((id) => !menuDishes.some((d) => d.dish_id === id));
    return { cat, limit, selectedIds, dishes, orphanIds };
  });
  const hasMenuSelection = menuByCategory.some((c) => c.selectedIds.length > 0);

  const removeMenuDish = (cat: MenuCategory, dishId: string) => {
    const current = lead.menu_selection?.[cat] ?? [];
    updateLeadMenuSelection(lead.lead_id, cat, current.filter((id) => id !== dishId));
  };
  const quoteItems: QuoteItem[] = cartLines.map((l) => ({
    item_id: l.item.item_id,
    name: l.item.name,
    quantity: l.line.quantity,
    unitPrice: l.unitPrice,
    vatMode: l.vatMode,
  }));
  const vatAmount = cartLines.reduce((sum, l) => sum + l.lineVat, 0);
  const cartTotal = cartLines.reduce((sum, l) => sum + l.lineTotal, 0);
  // חריגת מקדמה ספציפית לאירוע הזה (deposit_override_*) גוברת על ברירת
  // המחדל הארגונית — נקבעת רק ע"י admin, ולא משנה את ברירת המחדל של אחרים.
  const hasDepositOverride = lead.deposit_override_mode != null && lead.deposit_override_value != null;
  const depositMode = hasDepositOverride ? lead.deposit_override_mode! : (orgDoc?.depositMode ?? "percent");
  const depositPercent = hasDepositOverride
    ? (depositMode === "percent" ? lead.deposit_override_value! : 0)
    : (orgDoc?.depositPercent ?? DEFAULT_DEPOSIT_PERCENT);
  const depositAmount = hasDepositOverride
    ? (depositMode === "fixed" ? lead.deposit_override_value! : 0)
    : (orgDoc?.depositAmount ?? 0);
  const depositDisplay = depositMode === "percent" ? `${depositPercent}%` : formatCurrency(depositAmount);
  const receivedAmount = depositPaid ? (depositMode === "percent" ? cartTotal * (depositPercent / 100) : depositAmount) : 0;
  const balanceDue = cartTotal - receivedAmount;

  const openDepositOverrideEditor = () => {
    setDepositOverrideModeDraft(depositMode);
    setDepositOverrideValueDraft(String(depositMode === "percent" ? depositPercent : depositAmount));
    setDepositOverrideEditing(true);
  };
  const saveDepositOverride = () => {
    const value = Number(depositOverrideValueDraft);
    if (!depositOverrideValueDraft.trim() || Number.isNaN(value) || value < 0) {
      toast.error("יש להזין ערך מקדמה תקין");
      return;
    }
    setLeadDepositOverride(lead.lead_id, { mode: depositOverrideModeDraft, value });
    setDepositOverrideEditing(false);
    toast.success("המקדמה לאירוע זה עודכנה");
  };
  const clearDepositOverride = () => {
    setLeadDepositOverride(lead.lead_id, null);
    setDepositOverrideEditing(false);
    toast.success("חזרה לברירת המחדל הארגונית");
  };

  const openDocRename = (docId: string, currentName: string) => {
    setDocRenameTarget(docId);
    setDocRenameDraft(currentName);
  };
  const confirmDocRename = () => {
    if (!docRenameTarget || !docRenameDraft.trim()) return;
    renameDocument(lead.lead_id, docRenameTarget, docRenameDraft.trim());
    setDocRenameTarget(null);
    toast.success("שם המסמך עודכן");
  };
  const confirmDocDelete = () => {
    if (!docDeleteTarget) return;
    deleteDocument(lead.lead_id, docDeleteTarget);
    setDocDeleteTarget(null);
    toast.success("המסמך נמחק");
  };

  const toggleCartPickerSelection = (itemId: string) => {
    setCartPickerSelection((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };
  const confirmAddCartItems = () => {
    if (cartPickerSelection.length === 0) return;
    addCartItems(lead.lead_id, cartPickerSelection);
    setCartPickerSelection([]);
    setCartPickerOpen(false);
  };
  const addBundleToCart = (bundle: (typeof catalogBundles)[number]) => {
    const existingIds = new Set((lead.cart ?? []).map((l) => l.item_id));
    const missingIds = bundle.item_ids.filter((id) => !existingIds.has(id));
    if (missingIds.length === 0) return;
    addCartItems(lead.lead_id, missingIds);
    setCartPickerOpen(false);
  };

  return (
    <>
    <Sheet open={!!leadId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full! sm:max-w-3xl! overflow-hidden p-0"
      >
        <div className="flex h-full w-full flex-col overflow-hidden">
          {/* Header: hero + status */}
          <SheetHeader className="gap-0 border-b border-border pb-4">
            <div className="flex items-start gap-4 pl-8">
              {/* תמונת האירוע/הזוג — ניתנת להעלאה, עם פלייסהולדר דקורטיבי כשאין תמונה */}
              <label
                className="group/photo relative block size-[84px] shrink-0 cursor-pointer overflow-hidden rounded-2xl"
                aria-label="העלה תמונה"
              >
                {lead.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL, not a static/next-optimizable asset
                  <img src={lead.photo_url} alt="" className="size-full object-cover" />
                ) : (
                  <div
                    className="aurora-card relative flex size-full items-center justify-center"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, var(--color-accent-100) 0 2px, var(--card) 2px 14px)",
                    }}
                  >
                    <span className="aurora-glow" aria-hidden="true" />
                    <EventTypeIcon
                      icon={eventType?.icon}
                      className="relative size-9 text-foreground/60"
                    />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/photo:bg-black/40 group-hover/photo:opacity-100">
                  <Camera className="size-5 text-white" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={uploadingPhoto}
                  onChange={handlePhotoChange}
                />
              </label>
              <div className="min-w-0 flex-1">
                {editingTitle ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      placeholder="כותרת מותאמת אישית (ריק = אוטומטי)"
                      className="h-8 font-heading text-[18px] font-semibold"
                    />
                    <Button size="icon-sm" variant="outline" onClick={saveTitle} aria-label="שמור">
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setEditingTitle(false)}
                      aria-label="ביטול"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <SheetTitle className="font-heading text-[26px] font-semibold">
                      {getEventTitle(lead, eventType)}
                    </SheetTitle>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={startEditingTitle}
                      aria-label="ערוך כותרת"
                      className="shrink-0"
                    >
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                )}
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  נפתח לראשונה {formatDateTime(lead.created_at)}
                </p>
                <SheetDescription className="sr-only">{getEventTitle(lead, eventType)}</SheetDescription>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {repName}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    מקור: {lead.lead_source}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-start gap-2 px-1">
              <span className="pt-1.5 text-[13px] text-muted-foreground">סטטוס הכרטיס</span>
              <div className="grid gap-0.5">
                <Select
                  value={lead.status}
                  onValueChange={(v) => v && handleStatusChange(v as LeadStatus)}
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
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs
            key={leadId}
            defaultValue={initialTab ?? "overview"}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <TabsList
              variant="line"
              className="h-auto shrink-0 justify-start border-b border-border px-4"
            >
              <TabsTrigger value="overview" className="flex-none px-4 py-2.5">סקירה</TabsTrigger>
              {role !== "event_manager" && (
                <TabsTrigger value="pay" className="flex-none px-4 py-2.5">תשלומים</TabsTrigger>
              )}
              <TabsTrigger value="menu" className="flex-none px-4 py-2.5">תפריט</TabsTrigger>
              <TabsTrigger value="docs" className="flex-none px-4 py-2.5">מסמכים</TabsTrigger>
              {/* תכנון האירוע הוא שלב תפעולי שמתחיל אחרי סגירת העסקה — בליד
                  פתוח הטאב הזה רק רעש. */}
              {lead.status === "closed" && (
                <TabsTrigger value="planning" className="flex-none px-4 py-2.5">תכנון האירוע</TabsTrigger>
              )}
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {/* ── סקירה ── */}
              <TabsContent value="overview" className="grid gap-3.5">
                <BlueprintBox>
                  <BoxKicker>פרטי האירוע</BoxKicker>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Chip label="מקום">{venueName}</Chip>
                    <Chip label="סוג אירוע">{eventType?.name ?? "—"}</Chip>
                    <button onClick={openScheduleDialog} className="cursor-pointer text-right">
                      <Chip label="חודש" editable>
                        {lead.event_date ? formatMonth(lead.event_date) : (lead.event_season_preferred ?? "—")}
                      </Chip>
                    </button>
                    <button onClick={openScheduleDialog} className="cursor-pointer text-right">
                      <Chip label="תאריך" editable>{formatDate(lead.event_date)}</Chip>
                    </button>
                    <button onClick={openScheduleDialog} className="cursor-pointer text-right">
                      <Chip label="יום" editable>{formatWeekday(lead.event_date)}</Chip>
                    </button>
                    <button onClick={openScheduleDialog} className="cursor-pointer text-right">
                      <Chip label="שעות" editable>
                        {lead.event_start_time && lead.event_end_time
                          ? `${lead.event_start_time} - ${lead.event_end_time}`
                          : "—"}
                      </Chip>
                    </button>
                    <button onClick={openGuestsDialog} className="cursor-pointer text-right">
                      <Chip label="מוזמנים" editable>{lead.estimated_guests}</Chip>
                    </button>
                  </div>
                  <div className="mt-2.5 border-t border-border pt-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[.06em] text-muted-foreground">מעקב פגישות</p>
                      <button
                        onClick={openMeetingDialog}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="size-3" />
                        פגישה חדשה
                      </button>
                    </div>
                    {(lead.meetings ?? []).length === 0 ? (
                      <p className="py-1 text-xs text-muted-foreground">אין פגישות רשומות עדיין.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(lead.meetings ?? []).map((m) => {
                          const state = getMeetingEffectiveState(m);
                          const color = MEETING_TYPE_COLORS[m.type];
                          return (
                            <button
                              key={m.meeting_id}
                              onClick={() => setViewMeetingId(m.meeting_id)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-opacity hover:opacity-80",
                                state === "cancelled" && "line-through opacity-50"
                              )}
                              style={{ background: `${color}22`, color }}
                            >
                              {MEETING_TYPE_LABELS[m.type]}
                              <span className="font-normal opacity-70">
                                · {state === "done" ? "התקיימה" : state === "cancelled" ? "בוטלה" : m.date ? formatDate(m.date) : "טרם נקבע"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5">
                    <p className="mb-1 text-[10px] uppercase tracking-[.06em] text-muted-foreground">
                      הבטחות והערות לזוג
                    </p>
                    {lead.promises ? (
                      <button
                        onClick={openPromisesDialog}
                        className="w-full rounded-md border border-dashed border-border px-2.5 py-1.5 text-right text-[13px] text-muted-foreground hover:bg-muted/60"
                      >
                        <span className="line-clamp-2">{lead.promises}</span>
                      </button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={openPromisesDialog}>
                        <Plus className="size-3.5" />
                        הבטחות
                      </Button>
                    )}
                  </div>
                </BlueprintBox>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <BlueprintBox>
                    <div className="flex items-center justify-between">
                      <BoxKicker className="mb-0">מטלות ({leadOpenTasks.length})</BoxKicker>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingTask(null);
                            setTaskDialogOpen(true);
                          }}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="size-3" />
                          חדשה
                        </button>
                        <button
                          onClick={() => setTasksExpanded(true)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Maximize2 className="size-3" />
                          הרחב
                        </button>
                      </div>
                    </div>
                    <ul className="mt-2 grid max-h-[160px] gap-0.5 overflow-y-auto">
                      {leadTasks.length === 0 && (
                        <p className="py-3 text-center text-xs text-muted-foreground">אין מטלות לליד זה.</p>
                      )}
                      {leadTasks.map((t) => (
                        <LeadTaskItem
                          key={t.task_id}
                          task={t}
                          onEdit={(task) => {
                            setEditingTask(task);
                            setTaskDialogOpen(true);
                          }}
                        />
                      ))}
                    </ul>
                  </BlueprintBox>

                  <BlueprintBox>
                    <div className="flex items-center justify-between">
                      <BoxKicker className="mb-0">תיעוד ותקשורת</BoxKicker>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActivityDialogOpen(true)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="size-3" />
                          תיעוד
                        </button>
                        <button
                          onClick={() => setDocsExpanded(true)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Maximize2 className="size-3" />
                          הרחב
                        </button>
                      </div>
                    </div>
                    <Tabs value={activityTab} onValueChange={(v) => setActivityTab(v as "manual" | "system")}>
                      <TabsList variant="line" className="mt-1 h-auto w-fit justify-start border-b border-border">
                        <TabsTrigger value="manual" className="flex-none px-3 py-1.5 text-xs">
                          תיעוד ({manualActivity.length})
                        </TabsTrigger>
                        <TabsTrigger value="system" className="flex-none px-3 py-1.5 text-xs">
                          מערכת ({systemActivity.length})
                        </TabsTrigger>
                      </TabsList>
                      {(["manual", "system"] as const).map((tab) => {
                        const rows = tab === "manual" ? manualActivity : systemActivity;
                        return (
                          <TabsContent key={tab} value={tab}>
                            <ol className="mt-2 grid max-h-[160px] gap-2 overflow-y-auto">
                              {rows.length === 0 && (
                                <p className="py-3 text-center text-xs text-muted-foreground">
                                  {tab === "manual" ? "אין תיעוד ידני עדיין." : "אין רישומי מערכת עדיין."}
                                </p>
                              )}
                              {rows.slice(0, 8).map((a) => (
                                <ActivityRow
                                  key={a.activity_id}
                                  activityId={a.activity_id}
                                  content={a.content}
                                  type={a.activity_type}
                                  createdAt={a.created_at}
                                  userName={members.find((m) => m.user_id === a.user_id)?.full_name}
                                  highlighted={a.activity_id === highlightActivityId}
                                  // רישומי מערכת הם תיעוד אמין של מה שקרה בפועל —
                                  // עריכה/מחיקה שלהם תהפוך אותם לחסרי ערך.
                                  editable={!isSystemActivity(a)}
                                  editing={editingActivityId === a.activity_id}
                                  editValue={editingActivityContent}
                                  onEditValueChange={setEditingActivityContent}
                                  onStartEdit={() => startEditActivity(a.activity_id, a.content)}
                                  onSaveEdit={saveActivityEdit}
                                  onCancelEdit={() => setEditingActivityId(null)}
                                  onDelete={() => setDeleteActivityTarget(a.activity_id)}
                                />
                              ))}
                            </ol>
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </BlueprintBox>
                </div>

                <BlueprintBox>
                  <div className="flex items-center justify-between">
                    <BoxKicker className="mb-0">אנשי קשר</BoxKicker>
                    <button
                      onClick={openAddContact}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-3" />
                      הוסף
                    </button>
                  </div>

                  <div className="mt-1">
                    {(lead.contacts ?? []).map((c) => (
                      <div
                        key={c.contact_id}
                        className="group flex items-center justify-between gap-3 border-t border-border py-2 text-[13px] first:border-t-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{getRoleLabel(c.role_key)}</p>
                          {/* פרטי הקשר המלאים מוצגים כאן ולא רק בעריכה — נציג
                              צריך לראות ת.ז וכתובת מול הזוג בלי לפתוח טופס.
                              שורה אחת עם מפרידים; גולשת לשורה נוספת במסך צר. */}
                          <ContactDetails contact={c} fallbackEmail={lead.email} />
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                          {c.phone && (
                            <>
                              <a href={telLink(c.phone)} aria-label="התקשר" className="hover:text-foreground">
                                <Phone className="size-4" />
                              </a>
                              <a
                                href={waLink(c.phone, `שלום ${c.name}, `)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="וואטסאפ"
                                className="hover:text-foreground"
                                onClick={() =>
                                  addSystemActivity(lead.lead_id, "whatsapp", `נשלחה הודעת WhatsApp ל${c.name}.`)
                                }
                              >
                                <WhatsappIcon className="size-4" />
                              </a>
                              <a href={smsLink(c.phone)} aria-label="הודעה" className="hover:text-foreground">
                                <MessageSquare className="size-4" />
                              </a>
                            </>
                          )}
                          {(c.email ?? lead.email) && (
                            <a href={mailLink(c.email ?? lead.email!)} aria-label="מייל" className="hover:text-foreground">
                              <Mail className="size-4" />
                            </a>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button size="icon-sm" variant="ghost" aria-label="עוד אפשרויות" />}
                            >
                              <MoreVertical className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditContact(c)}>
                                <Pencil className="size-3.5" />
                                עריכה
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteContactTarget(c.contact_id)}
                              >
                                <Trash2 className="size-3.5" />
                                הסר
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                    {(lead.contacts ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">אין אנשי קשר רשומים.</p>
                    )}
                  </div>
                </BlueprintBox>

                {role === "admin" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="size-3.5" />
                    מחק כרטיס
                  </Button>
                )}
              </TabsContent>

              {/* ── תשלומים ── */}
              <TabsContent value="pay" className="grid gap-3.5">
                <BlueprintBox className="p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2.5">
                    <BoxKicker className="mb-0">עגלת האירוע</BoxKicker>
                    <div className="flex flex-wrap gap-1.5">
                      {cartLocked ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setCartLocked(lead.lead_id, false)}
                        >
                          <Unlock className="size-3.5" />
                          ערוך עגלה
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => {
                              setCartPickerSelection([]);
                              setCartPickerOpen(true);
                            }}
                          >
                            <Plus className="size-3.5" />
                            הוסף פריטים
                          </Button>
                          {cartLines.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => setCartLocked(lead.lead_id, true)}
                            >
                              <Lock className="size-3.5" />
                              נעל עגלה
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-[11px] uppercase tracking-[.08em] text-muted-foreground">
                          <th className="p-2.5 text-right font-normal">תיאור</th>
                          <th className="p-2.5 text-right font-normal">כמות</th>
                          <th className="p-2.5 text-right font-normal">מחיר ליחידה</th>
                          <th className="p-2.5 text-right font-normal">מע״מ</th>
                          <th className="p-2.5 text-right font-normal">סה״כ</th>
                          <th className="p-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {cartLines.map(({ line, item, unitPrice, vatMode, lineTotal }) => (
                          <tr key={item.item_id} className="border-b border-border/60">
                            <td className="p-2.5 font-medium">{item.name}</td>
                            <td className="p-2.5">
                              {cartLocked ? (
                                line.quantity
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  value={line.quantity}
                                  onChange={(e) =>
                                    updateCartLine(lead.lead_id, item.item_id, {
                                      quantity: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className="h-7 w-20 text-sm"
                                />
                              )}
                            </td>
                            <td className="p-2.5">
                              {cartLocked ? (
                                formatCurrency(unitPrice)
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  value={unitPrice}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateCartLine(lead.lead_id, item.item_id, {
                                      price_override: val === "" ? undefined : Number(val),
                                    });
                                  }}
                                  className="h-7 w-24 text-sm"
                                />
                              )}
                            </td>
                            <td className="p-2.5">
                              {cartLocked ? (
                                vatMode === "included" ? "כולל מע״מ" : "לפני מע״מ"
                              ) : (
                                <Select
                                  value={vatMode}
                                  onValueChange={(v) =>
                                    v && updateCartLine(lead.lead_id, item.item_id, { vat_mode: v as "plus_vat" | "included" })
                                  }
                                >
                                  <SelectTrigger size="sm" className="w-[110px] text-xs">
                                    <SelectValue>
                                      {(v: string) => (v === "included" ? "כולל מע״מ" : "לפני מע״מ")}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="plus_vat">לפני מע״מ</SelectItem>
                                    <SelectItem value="included">כולל מע״מ</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </td>
                            <td className="p-2.5 font-medium">{formatCurrency(lineTotal)}</td>
                            <td className="p-2.5 text-left">
                              {!cartLocked && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  aria-label="הסר פריט"
                                  onClick={() => removeCartItem(lead.lead_id, item.item_id)}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {cartLines.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-muted-foreground">
                              אין פריטים בעגלה. לחץ על &quot;הוסף פריטים&quot; כדי לבחור מהקטלוג.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </BlueprintBox>

                <BlueprintBox>
                  <FieldRow label={`סה״כ מע״מ (${vatPercent}%)`}>{formatCurrency(vatAmount)}</FieldRow>
                  <FieldRow label="סה״כ לתשלום">
                    <span className="font-heading text-base font-semibold">{formatCurrency(cartTotal)}</span>
                  </FieldRow>
                  <FieldRow
                    label={
                      <span className="inline-flex items-center gap-1">
                        {`התקבל מקדמה (${depositDisplay}${hasDepositOverride ? " · מותאם" : ""})`}
                        {role === "admin" && !depositOverrideEditing && (
                          <button
                            type="button"
                            aria-label="ערוך מקדמה לאירוע זה"
                            onClick={openDepositOverrideEditor}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-3" />
                          </button>
                        )}
                      </span>
                    }
                  >
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={depositPaid}
                        onChange={() => toggleMilestone(lead.lead_id, "deposit_paid")}
                        className="accent-primary"
                      />
                      {formatCurrency(receivedAmount)}
                    </label>
                  </FieldRow>
                  {role === "admin" && depositOverrideEditing && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
                      <div className="flex overflow-hidden rounded-md border border-border">
                        <button
                          type="button"
                          onClick={() => setDepositOverrideModeDraft("percent")}
                          className={cn(
                            "px-2.5 py-1.5",
                            depositOverrideModeDraft === "percent"
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          אחוז
                        </button>
                        <button
                          type="button"
                          onClick={() => setDepositOverrideModeDraft("fixed")}
                          className={cn(
                            "border-r border-border px-2.5 py-1.5",
                            depositOverrideModeDraft === "fixed"
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          סכום קבוע
                        </button>
                      </div>
                      <Input
                        type="number"
                        dir="ltr"
                        value={depositOverrideValueDraft}
                        onChange={(e) => setDepositOverrideValueDraft(e.target.value)}
                        className="h-8 w-24"
                      />
                      <Button size="sm" onClick={saveDepositOverride}>
                        שמור
                      </Button>
                      {hasDepositOverride && (
                        <Button size="sm" variant="outline" onClick={clearDepositOverride}>
                          איפוס לברירת מחדל
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDepositOverrideEditing(false)}>
                        ביטול
                      </Button>
                    </div>
                  )}
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
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          setQuoteDocType("quote");
                          setQuoteDialogOpen(true);
                        }}
                      >
                        <FileText className="size-3.5" />
                        הפק הצעת מחיר
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          setQuoteDocType("contract");
                          setQuoteDialogOpen(true);
                        }}
                      >
                        <FileText className="size-3.5" />
                        הפק חוזה
                      </Button>
                    </div>
                  )}
                </BlueprintBox>

                <BlueprintBox>
                  <BoxKicker>מסמכי הצעה / חוזה</BoxKicker>
                  {financialDocs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">טרם הופקו מסמכים פיננסיים.</p>
                  ) : (
                    <div className="grid gap-1.5">
                      {financialDocs.map((doc) => {
                        const creatorName = members.find((m) => m.user_id === doc.created_by_user_id)?.full_name;
                        const editorName = members.find((m) => m.user_id === doc.updated_by_user_id)?.full_name;
                        return (
                          <div key={doc.doc_id} className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0">
                            <button
                              type="button"
                              onClick={() => setViewingDoc({ name: doc.name, url: doc.url })}
                              className="flex flex-1 items-center gap-2 text-right hover:opacity-80"
                            >
                              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{doc.name}</span>
                                <span className="block truncate text-[10px] text-muted-foreground">
                                  {doc.updated_at
                                    ? `עודכן ${formatDateTime(doc.updated_at)}${editorName ? ` ע״י ${editorName}` : ""}`
                                    : `נוצר ${formatDateTime(doc.created_at)}${creatorName ? ` ע״י ${creatorName}` : ""}`}
                                </span>
                              </span>
                            </button>
                            <Badge variant="secondary" className="rounded-full text-[10px]">
                              {doc.type === "quote" ? "הצעת מחיר" : "חוזה"}
                            </Badge>
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => openDocRename(doc.doc_id, doc.name)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => setDocDeleteTarget(doc.doc_id)}>
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </BlueprintBox>
              </TabsContent>

              {/* ── תפריט ── */}
              <TabsContent value="menu" className="grid gap-3.5">
                {menuLocked ? (
                  <BlueprintBox>
                    {role !== "office" && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={generatingMenuPdf}
                          onClick={handleGenerateMenuPdf}
                        >
                          <FileText className="size-3.5" />
                          {generatingMenuPdf ? "מפיק..." : "הפקת תפריט לזוג"}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePrintMenu}>
                          <Printer className="size-3.5" />
                          הדפסה
                        </Button>
                      </div>
                    )}
                    <div className="mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setLeadMenuLocked(lead.lead_id, false)}
                      >
                        <Pencil className="size-3.5" />
                        עריכה
                      </Button>
                    </div>
                    {menuByCategory
                      .filter((c) => c.selectedIds.length > 0)
                      .map(({ cat, selectedIds, dishes }) => (
                        <div key={cat} className="mb-3 last:mb-0">
                          <BoxKicker className="mb-1">{cat}</BoxKicker>
                          <div className="grid gap-1">
                            {selectedIds.map((dishId) => {
                              const dish = dishes.find((d) => d.dish_id === dishId);
                              const inactive = dish ? dish.active === false : true;
                              const note = lead.menu_selection_notes?.[dishId];
                              const noteOpen = menuNoteOpenFor === dishId;
                              return (
                                <div key={dishId} className="border-t border-border py-1.5 first:border-t-0">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => dish && openMenuNote(dishId)}
                                      disabled={!dish}
                                      className={cn(
                                        "flex-1 text-right text-sm hover:underline",
                                        inactive && "text-muted-foreground line-through"
                                      )}
                                    >
                                      {dish?.name ?? "מנה שהוסרה מהמאגר"}
                                    </button>
                                    {inactive && (
                                      <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                                        {dish ? "לא פעילה יותר" : "נמחקה מהמאגר"}
                                      </Badge>
                                    )}
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-6 shrink-0"
                                      aria-label="הסרה"
                                      onClick={() => removeMenuDish(cat, dishId)}
                                    >
                                      <X className="size-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                  {noteOpen ? (
                                    <Input
                                      autoFocus
                                      value={menuNoteDraft}
                                      onChange={(e) => setMenuNoteDraft(e.target.value)}
                                      onBlur={saveMenuNote}
                                      onKeyDown={(e) => e.key === "Enter" && saveMenuNote()}
                                      placeholder="לדוגמה: יותר מבושל, מרכז שולחן..."
                                      className="mt-1 h-7 text-xs"
                                    />
                                  ) : note ? (
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </BlueprintBox>
                ) : (
                  <div className="grid gap-3.5 lg:grid-cols-[1fr_240px] lg:items-start">
                    <div className="grid gap-3.5">
                      {menuByCategory.map(({ cat, limit, selectedIds, dishes, orphanIds }) => {
                        const capReached = selectedIds.length >= limit && !menuIsAdmin;
                        const overCap = selectedIds.length > limit;
                        const pct = Math.min(100, Math.round((selectedIds.length / Math.max(limit, 1)) * 100));

                        const toggleDish = (dishId: string) => {
                          const isSelected = selectedIds.includes(dishId);
                          if (!isSelected && capReached) {
                            toast.error(`הגעת למכסה של ${limit} מנות בקטגוריה זו — admin יכול לחרוג ממנה`);
                            return;
                          }
                          const next = isSelected ? selectedIds.filter((id) => id !== dishId) : [...selectedIds, dishId];
                          if (!isSelected && menuIsAdmin && next.length > limit) {
                            toast.warning(`מוסיף מעבר למכסה (${limit} מנות) — חריגת admin`);
                          }
                          updateLeadMenuSelection(lead.lead_id, cat, next);
                        };

                        return (
                          <BlueprintBox key={cat}>
                            <div className="mb-2 flex items-center gap-3">
                              <div
                                className="grid size-11 shrink-0 place-items-center rounded-full"
                                style={{
                                  background: `conic-gradient(${overCap ? "var(--destructive)" : "var(--foreground)"} ${pct}%, var(--border) 0)`,
                                }}
                              >
                                <div
                                  className={cn(
                                    "grid size-8 place-items-center rounded-full bg-background text-xs font-bold tabular-nums",
                                    overCap && "text-destructive"
                                  )}
                                >
                                  {selectedIds.length}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <BoxKicker className="mb-0">{cat}</BoxKicker>
                                <p className={cn("text-[11px]", overCap ? "font-medium text-destructive" : "text-muted-foreground")}>
                                  {selectedIds.length} מתוך {limit} נבחרו
                                  {overCap && " — חריגת admin"}
                                </p>
                              </div>
                            </div>
                            {dishes.length === 0 && orphanIds.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                אין עדיין מנות בקטגוריה זו. ניתן להוסיף במאגר המנות בהגדרות.
                              </p>
                            ) : (
                              <div className="grid gap-1">
                                {dishes.map((dish) => {
                                  const rank = selectedIds.indexOf(dish.dish_id);
                                  const isSelected = rank > -1;
                                  const disabled = !isSelected && capReached;
                                  const inactive = dish.active === false;
                                  return (
                                    <button
                                      key={dish.dish_id}
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => toggleDish(dish.dish_id)}
                                      className={cn(
                                        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-right text-sm transition-colors",
                                        isSelected ? "border-foreground bg-foreground/5" : "border-border",
                                        disabled && "cursor-not-allowed opacity-50"
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                                          isSelected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                                        )}
                                      >
                                        {isSelected ? rank + 1 : ""}
                                      </span>
                                      <span className="flex-1">{dish.name}</span>
                                      {inactive && (
                                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                          לא פעילה יותר
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                                {orphanIds.map((dishId) => {
                                  const rank = selectedIds.indexOf(dishId);
                                  return (
                                    <div
                                      key={dishId}
                                      className="flex items-center gap-2.5 rounded-lg border border-border bg-foreground/5 px-2.5 py-2 text-sm"
                                    >
                                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                                        {rank + 1}
                                      </span>
                                      <span className="flex-1 text-muted-foreground">מנה שהוסרה מהמאגר</span>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-6 shrink-0"
                                        aria-label="הסרה"
                                        onClick={() => toggleDish(dishId)}
                                      >
                                        <X className="size-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </BlueprintBox>
                        );
                      })}
                    </div>

                    {/* מיני-קארט: נכנס עם fade+scale ברגע שיש בחירה ראשונה, נשאר לצד
                        הבחירה, מקבץ לפי סדר הקטגוריות הקבוע (לא סדר הלחיצה). */}
                    <div
                      className={cn(
                        "rounded-lg border border-border bg-popover p-3 shadow-md transition-all duration-200",
                        hasMenuSelection ? "opacity-100" : "opacity-40"
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <ClipboardList className="size-4 text-muted-foreground" />
                        <span className="flex-1 text-sm font-medium">התפריט שלכם</span>
                      </div>
                      {!hasMenuSelection ? (
                        <p className="text-xs text-muted-foreground">עוד לא נבחרו מנות.</p>
                      ) : (
                        <div className="grid gap-2.5">
                          {menuByCategory
                            .filter((c) => c.selectedIds.length > 0)
                            .map(({ cat, limit, selectedIds, dishes }) => (
                              <div key={cat}>
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="flex-1 truncate text-[11px] text-muted-foreground">{cat}</span>
                                  <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                                    {selectedIds.length} / {limit}
                                  </Badge>
                                </div>
                                <div className="grid gap-1">
                                  {selectedIds.map((dishId) => {
                                    const dish = dishes.find((d) => d.dish_id === dishId);
                                    const note = lead.menu_selection_notes?.[dishId];
                                    const noteOpen = menuNoteOpenFor === dishId;
                                    return (
                                      <div key={dishId}>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            disabled={!dish}
                                            onClick={() => dish && openMenuNote(dishId)}
                                            className={cn(
                                              "min-w-0 flex-1 truncate text-right text-xs hover:underline",
                                              !dish && "text-muted-foreground",
                                              note && "font-medium text-foreground"
                                            )}
                                          >
                                            {dish?.name ?? "מנה שהוסרה מהמאגר"}
                                          </button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-5 shrink-0"
                                            aria-label="הסרה"
                                            onClick={() => removeMenuDish(cat, dishId)}
                                          >
                                            <X className="size-3 text-destructive" />
                                          </Button>
                                        </div>
                                        {noteOpen ? (
                                          <Input
                                            autoFocus
                                            value={menuNoteDraft}
                                            onChange={(e) => setMenuNoteDraft(e.target.value)}
                                            onBlur={saveMenuNote}
                                            onKeyDown={(e) => e.key === "Enter" && saveMenuNote()}
                                            placeholder="לדוגמה: יותר מבושל, מרכז שולחן..."
                                            className="mt-1 h-6 text-[11px]"
                                          />
                                        ) : note ? (
                                          <p className="mt-0.5 text-[10px] text-muted-foreground">{note}</p>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          <Button
                            size="sm"
                            className="mt-1 w-full gap-1.5"
                            onClick={() => setLeadMenuLocked(lead.lead_id, true)}
                          >
                            <Lock className="size-3.5" />
                            שמירת התפריט
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
                  <MenuPrintable
                    ref={menuPreviewRef}
                    title={getEventTitle(lead, eventType)}
                    venueName={orgDoc?.name}
                    contacts={lead.contacts}
                    eventDate={lead.event_date}
                    startTime={lead.event_start_time}
                    guests={lead.estimated_guests}
                    menuDishes={menuDishes}
                    menuSelection={lead.menu_selection}
                    menuNotes={lead.menu_selection_notes}
                  />
                </div>
              </TabsContent>

              {/* ── מסמכים ── */}
              <TabsContent value="docs">
                <BlueprintBox>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <BoxKicker className="mb-0">ספריית מסמכים</BoxKicker>
                    {role !== "office" && (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setPickOrgFileOpen(true)}
                        >
                          <FolderOpen className="size-3.5" />
                          בחר מהמאגר
                        </Button>
                        <label
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "cursor-pointer gap-1.5",
                            uploadingDoc && "pointer-events-none opacity-50"
                          )}
                        >
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                            className="sr-only"
                            disabled={uploadingDoc}
                            onChange={handleUploadDocument}
                          />
                          <Upload className="size-3.5" />
                          {uploadingDoc ? "מעלה..." : "העלה קובץ"}
                        </label>
                      </div>
                    )}
                  </div>
                  {lead.documents.length === 0 && (
                    <p className="text-xs text-muted-foreground">אין מסמכים עדיין.</p>
                  )}
                  <div className="grid gap-1.5">
                    {lead.documents.map((doc) => {
                      const creatorName = members.find((m) => m.user_id === doc.created_by_user_id)?.full_name;
                      const editorName = members.find((m) => m.user_id === doc.updated_by_user_id)?.full_name;
                      return (
                        <div key={doc.doc_id} className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0">
                          <button
                            type="button"
                            onClick={() => setViewingDoc({ name: doc.name, url: doc.url })}
                            className="flex flex-1 items-center gap-2 text-right hover:opacity-80"
                          >
                            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{doc.name}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {doc.updated_at
                                  ? `עודכן ${formatDateTime(doc.updated_at)}${editorName ? ` ע״י ${editorName}` : ""}`
                                  : `נוצר ${formatDateTime(doc.created_at)}${creatorName ? ` ע״י ${creatorName}` : ""}`}
                              </span>
                            </span>
                          </button>
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            {doc.type === "quote" ? "הצעת מחיר" : doc.type === "contract" ? "חוזה" : "אחר"}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button size="icon" variant="ghost" className="size-7" aria-label="שתף" />}>
                              <Share2 className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleShareWhatsApp(doc)}>
                                <WhatsappIcon className="size-3.5" />
                                שיתוף ב-WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={sendingDocId === doc.doc_id}
                                onClick={() => handleSendFromSystem(doc)}
                              >
                                <Send className="size-3.5" />
                                {sendingDocId === doc.doc_id ? "שולח..." : "שלח מהמערכת"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleShareEmail(doc, "gmail")}>
                                <Mail className="size-3.5" />
                                שיתוף ב-Gmail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleShareEmail(doc, "client")}>
                                <Mail className="size-3.5" />
                                שיתוף בתוכנת המייל
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyLink(doc)}>
                                <LinkIcon className="size-3.5" />
                                העתק קישור
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => openDocRename(doc.doc_id, doc.name)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => setDocDeleteTarget(doc.doc_id)}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </BlueprintBox>
              </TabsContent>

              {lead.status === "closed" && (
                <TabsContent value="planning">
                  <EventPlanningTab
                    lead={lead}
                    eventType={eventType}
                    readOnly={!canEditPlanning}
                    onExit={() => onOpenChange(false)}
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    <NewTaskDialog
      open={taskDialogOpen}
      onOpenChange={setTaskDialogOpen}
      editTask={editingTask}
      lockedLeadId={lead.lead_id}
    />

    <Dialog open={tasksExpanded} onOpenChange={setTasksExpanded}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>כל המטלות — {getEventTitle(lead, eventType)}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1">
          <button
            onClick={() => setExpandedTaskTab("open")}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] transition-colors",
              expandedTaskTab === "open"
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            פתוחות
          </button>
          <button
            onClick={() => setExpandedTaskTab("done")}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] transition-colors",
              expandedTaskTab === "done"
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            בוצעו
          </button>
        </div>
        <ul className="grid max-h-[400px] gap-0.5 overflow-y-auto">
          {(expandedTaskTab === "open" ? leadOpenTasks : leadDoneTasks).length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">אין מטלות להצגה.</p>
          )}
          {(expandedTaskTab === "open" ? leadOpenTasks : leadDoneTasks).map((t) => (
            <LeadTaskItem
              key={t.task_id}
              task={t}
              onEdit={(task) => {
                setEditingTask(task);
                setTaskDialogOpen(true);
              }}
            />
          ))}
        </ul>
      </DialogContent>
    </Dialog>

    <Dialog open={docsExpanded} onOpenChange={setDocsExpanded}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>כל התיעוד — {getEventTitle(lead, eventType)}</DialogTitle>
        </DialogHeader>
        <Tabs value={activityTab} onValueChange={(v) => setActivityTab(v as "manual" | "system")}>
          <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
            <TabsTrigger value="manual" className="flex-none px-3 py-1.5 text-xs">
              תיעוד ({manualActivity.length})
            </TabsTrigger>
            <TabsTrigger value="system" className="flex-none px-3 py-1.5 text-xs">
              מערכת ({systemActivity.length})
            </TabsTrigger>
          </TabsList>
          {(["manual", "system"] as const).map((tab) => {
            const rows = tab === "manual" ? manualActivity : systemActivity;
            return (
              <TabsContent key={tab} value={tab}>
                <ol className="mt-2 grid max-h-[420px] gap-2.5 overflow-y-auto">
                  {rows.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      {tab === "manual" ? "אין תיעוד ידני עדיין." : "אין רישומי מערכת עדיין."}
                    </p>
                  )}
                  {rows.map((a) => (
                    <ActivityRow
                      key={a.activity_id}
                      activityId={a.activity_id}
                      content={a.content}
                      type={a.activity_type}
                      createdAt={a.created_at}
                      userName={members.find((m) => m.user_id === a.user_id)?.full_name}
                      highlighted={a.activity_id === highlightActivityId}
                      editable={!isSystemActivity(a)}
                      editing={editingActivityId === a.activity_id}
                      editValue={editingActivityContent}
                      onEditValueChange={setEditingActivityContent}
                      onStartEdit={() => startEditActivity(a.activity_id, a.content)}
                      onSaveEdit={saveActivityEdit}
                      onCancelEdit={() => setEditingActivityId(null)}
                      onDelete={() => setDeleteActivityTarget(a.activity_id)}
                    />
                  ))}
                </ol>
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>

    <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>תיעוד חדש</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Select value={newType} onValueChange={(v) => v && setNewType(v as ActivityType)}>
            <SelectTrigger size="sm" className="w-full">
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
          <Textarea
            placeholder="הוסף הערה, תיעוד שיחה או עדכון..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>
            ביטול
          </Button>
          <Button disabled={!newContent.trim()} onClick={submitActivity}>
            אישור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <CartQuoteDialog
      lead={lead}
      items={quoteItems}
      vatPercent={vatPercent}
      open={quoteDialogOpen}
      onOpenChange={setQuoteDialogOpen}
      initialDocType={quoteDocType}
    />

    <Dialog open={!!docRenameTarget} onOpenChange={(o) => !o && setDocRenameTarget(null)}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>שינוי שם מסמך</DialogTitle>
        </DialogHeader>
        <Input value={docRenameDraft} onChange={(e) => setDocRenameDraft(e.target.value)} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => setDocRenameTarget(null)}>
            ביטול
          </Button>
          <Button disabled={!docRenameDraft.trim()} onClick={confirmDocRename}>
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={notRelevantDialogOpen} onOpenChange={setNotRelevantDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>לסמן את הכרטיס כלא רלוונטי?</AlertDialogTitle>
          <AlertDialogDescription>
            הכרטיס יוסר מרשימת הלידים הפעילים. אפשר להחזיר אותו לסטטוס אחר בכל שלב.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="lost_reason_draft">סיבת האובדן</Label>
          <Select value={lostReasonDraft} onValueChange={(v) => v && setLostReasonDraft(v as string)}>
            <SelectTrigger id="lost_reason_draft" className="w-full">
              <SelectValue>{(v: string) => v || "בחר סיבה…"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LOST_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction disabled={!lostReasonDraft} onClick={confirmNotRelevant}>
            סמן כלא רלוונטי
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!docDeleteTarget} onOpenChange={(o) => !o && setDocDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>למחוק את המסמך?</AlertDialogTitle>
          <AlertDialogDescription>המסמך יימחק מכרטיס האירוע והמחיקה תתועד בפיד הפעילות.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDocDelete}>מחק</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <DocumentViewerDialog doc={viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)} />

    <PickOrgFileDialog
      open={pickOrgFileOpen}
      onOpenChange={setPickOrgFileOpen}
      onPick={handlePickOrgFile}
      attachedUrls={lead.documents.map((d) => d.url)}
      contacts={lead.contacts}
    />

    <Dialog open={cartPickerOpen} onOpenChange={setCartPickerOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>הוספת פריטים לעגלה</DialogTitle>
        </DialogHeader>
        {catalogBundles.length > 0 && (
          <div className="grid gap-1 border-b border-border pb-2">
            <p className="text-[11px] font-medium text-muted-foreground">חבילות — הוספה מרוכזת בלחיצה אחת</p>
            {catalogBundles.map((bundle) => {
              const names = bundle.item_ids
                .map((id) => catalog.find((c) => c.item_id === id)?.name)
                .filter(Boolean)
                .join(" + ");
              const allInCart = bundle.item_ids.every((id) => (lead.cart ?? []).some((l) => l.item_id === id));
              return (
                <button
                  key={bundle.bundle_id}
                  type="button"
                  disabled={allInCart}
                  onClick={() => addBundleToCart(bundle)}
                  className="flex flex-col items-start gap-0.5 rounded-md border border-border px-2 py-1.5 text-right text-sm hover:bg-muted disabled:cursor-default disabled:opacity-50"
                >
                  <span className="font-medium">{bundle.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {allInCart ? "כל הפריטים כבר בעגלה" : names}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="grid max-h-72 gap-1 overflow-y-auto">
          {availableCatalog.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {catalog.length === 0
                ? "אין עדיין פריטים במאגר הקטלוג — הוסף פריטים למכירה בהגדרות > מאגר פריטים."
                : "כל פריטי הקטלוג הפעילים כבר נמצאים בעגלה."}
            </p>
          ) : (
            availableCatalog.map((item) => (
              <label
                key={item.item_id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={cartPickerSelection.includes(item.item_id)}
                  onChange={() => toggleCartPickerSelection(item.item_id)}
                  className="accent-primary"
                />
                <span className="flex-1">{item.name}</span>
                <span className="text-xs text-muted-foreground">{formatCurrency(item.price)}</span>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCartPickerOpen(false)}>
            ביטול
          </Button>
          <Button disabled={cartPickerSelection.length === 0} onClick={confirmAddCartItems}>
            הוסף ({cartPickerSelection.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>פגישה חדשה</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>סוג פגישה</Label>
            <Select value={meetingTypeDraft} onValueChange={(v) => v && setMeetingTypeDraft(v as MeetingType)}>
              <SelectTrigger>
                <SelectValue>{(v: string) => MEETING_TYPE_LABELS[v as MeetingType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MEETING_TYPE_LABELS) as MeetingType[])
                  .filter((t) => !CLOSED_ONLY_MEETING_TYPES.includes(t) || lead.status === "closed")
                  .map((type) => (
                  <SelectItem key={type} value={type}>
                    {MEETING_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="meeting_date_input">תאריך</Label>
              <DateField id="meeting_date_input" value={meetingDateDraft} onChange={setMeetingDateDraft} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="meeting_time_input">שעה</Label>
              <TimeField id="meeting_time_input" value={meetingTimeDraft} onChange={setMeetingTimeDraft} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meeting_notes_input">הערות</Label>
            <Textarea
              id="meeting_notes_input"
              placeholder='למשל: "באים רק לראות את המקום" / "מגיעים עם ההורים"'
              value={meetingNotesDraft}
              onChange={(e) => setMeetingNotesDraft(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMeetingDialogOpen(false)}>
            ביטול
          </Button>
          <Button disabled={meetingSubmitting} onClick={saveMeeting}>שמירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!viewMeetingId} onOpenChange={(o) => !o && setViewMeetingId(null)}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>פרטי פגישה</DialogTitle>
        </DialogHeader>
        {(() => {
          const m = (lead.meetings ?? []).find((mm) => mm.meeting_id === viewMeetingId);
          if (!m) return null;
          const state = getMeetingEffectiveState(m);
          return (
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: MEETING_TYPE_COLORS[m.type] }} />
                <span className="font-medium">{MEETING_TYPE_LABELS[m.type]}</span>
              </div>
              <FieldRow label="סטטוס">
                {state === "done" ? "התקיימה" : state === "cancelled" ? "בוטלה" : "נקבעה"}
              </FieldRow>
              <FieldRow label="תאריך">{m.date ? formatDate(m.date) : "טרם נקבע"}</FieldRow>
              {m.time && <FieldRow label="שעה">{m.time}</FieldRow>}
              {m.notes && <FieldRow label="הערות">{m.notes}</FieldRow>}
              {state === "cancelled" && m.cancelled_at && (
                <FieldRow label="בוטלה בתאריך">{formatDateTime(m.cancelled_at)}</FieldRow>
              )}
              <DialogFooter className="mt-2">
                {state !== "cancelled" && (
                  <Button
                    variant="ghost"
                    className="ml-auto text-destructive hover:text-destructive sm:ml-0 sm:mr-auto"
                    onClick={() => setMeetingCancelTarget(m.meeting_id)}
                  >
                    ביטול פגישה
                  </Button>
                )}
                {role === "admin" && (
                  <Button variant="destructive" onClick={() => setMeetingDeleteTarget(m.meeting_id)}>
                    <Trash2 className="size-3.5" />
                    מחיקה
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewMeetingId(null)}>
                  סגירה
                </Button>
              </DialogFooter>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!meetingCancelTarget} onOpenChange={(o) => !o && setMeetingCancelTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>לבטל את הפגישה?</AlertDialogTitle>
          <AlertDialogDescription>הפגישה תסומן כמבוטלת ותישאר ברשימה ובלוח השנה, מסומנת באפור.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>חזרה</AlertDialogCancel>
          <AlertDialogAction onClick={confirmCancelMeeting}>ביטול הפגישה</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog
      open={!!meetingDeleteTarget}
      onOpenChange={(o) => {
        if (!o) {
          setMeetingDeleteTarget(null);
          setMeetingDeletePinInput("");
        }
      }}
    >
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>מחיקת פגישה</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">פעולה בלתי הפיכה. הזן קוד מחיקה כדי להמשיך.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="meeting_delete_pin_input">קוד מחיקה</Label>
            <Input
              id="meeting_delete_pin_input"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={4}
              autoFocus
              value={meetingDeletePinInput}
              onChange={(e) => setMeetingDeletePinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitMeetingDeletePin())}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setMeetingDeleteTarget(null);
              setMeetingDeletePinInput("");
            }}
          >
            ביטול
          </Button>
          <Button variant="destructive" onClick={submitMeetingDeletePin}>
            מחק לצמיתות
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={promisesDialogOpen} onOpenChange={setPromisesDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>הבטחות והערות לזוג</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="מה הובטח לזוג? הנחות, תוספות, סיכומים מיוחדים..."
          value={promisesDraft}
          onChange={(e) => setPromisesDraft(e.target.value)}
          rows={4}
          autoFocus
        />
        <DialogFooter>
          {lead.promises && (
            <Button
              variant="ghost"
              className="ml-auto gap-1.5 text-destructive hover:text-destructive sm:ml-0 sm:mr-auto"
              onClick={deletePromises}
            >
              <Trash2 className="size-3.5" />
              מחק
            </Button>
          )}
          <Button variant="outline" onClick={() => setPromisesDialogOpen(false)}>
            ביטול
          </Button>
          <Button onClick={savePromises}>שמור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={closeEventDialogOpen} onOpenChange={setCloseEventDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>אישור סגירת אירוע</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="close_event_date">תאריך האירוע</Label>
            <DateField id="close_event_date" value={closeDateDraft} onChange={setCloseDateDraft} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={closeDayPartDraft === "evening" ? "default" : "outline"}
              onClick={() => setCloseDayPartDraft("evening")}
            >
              {EVENT_DAY_PART_LABELS.evening}
            </Button>
            <Button
              type="button"
              variant={closeDayPartDraft === "morning" ? "default" : "outline"}
              onClick={() => setCloseDayPartDraft("morning")}
            >
              {EVENT_DAY_PART_LABELS.morning}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="close_event_start">שעת התחלה</Label>
              <TimeField id="close_event_start" value={closeStartDraft} onChange={setCloseStartDraft} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="close_event_end">שעת סיום</Label>
              <TimeField id="close_event_end" value={closeEndDraft} onChange={setCloseEndDraft} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="close_event_guests">אישור כמות מוזמנים</Label>
            <Input
              id="close_event_guests"
              type="number"
              min={1}
              value={closeGuestsDraft}
              onChange={(e) => setCloseGuestsDraft(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>סגנון הגשה</Label>
            <Select
              value={closeServingStyleDraft}
              onValueChange={(v) => v && setCloseServingStyleDraft(v as MenuServingStyle)}
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: string) => (v ? MENU_SERVING_STYLE_LABELS[v as MenuServingStyle] : "בחירת סגנון הגשה…")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MENU_SERVING_STYLE_LABELS) as MenuServingStyle[]).map((style) => (
                  <SelectItem key={style} value={style}>
                    {MENU_SERVING_STYLE_LABELS[style]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCloseEventDialogOpen(false)}>
            ביטול
          </Button>
          <Button onClick={confirmCloseEvent} disabled={!closeEventFormValid}>
            סגירת האירוע
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>תאריך ושעות האירוע</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="schedule_date">תאריך</Label>
            <DateField id="schedule_date" value={scheduleDate} onChange={setScheduleDate} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="schedule_start">שעת התחלה</Label>
              <TimeField id="schedule_start" value={scheduleStart} onChange={setScheduleStart} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="schedule_end">שעת סיום</Label>
              <TimeField id="schedule_end" value={scheduleEnd} onChange={setScheduleEnd} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
            ביטול
          </Button>
          <Button onClick={saveSchedule}>שמור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={guestsDialogOpen} onOpenChange={setGuestsDialogOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>מספר מוזמנים</DialogTitle>
        </DialogHeader>
        <Input
          type="number"
          min={0}
          autoFocus
          value={guestsDraft}
          onChange={(e) => setGuestsDraft(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setGuestsDialogOpen(false)}>
            ביטול
          </Button>
          <Button onClick={saveGuests}>שמור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{contactDraft.contact_id ? "עריכת איש קשר" : "הוספת איש קשר"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              autoFocus
              value={contactDraft.name}
              onChange={(e) => setContactDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="שם"
            />
            <Input
              value={contactDraft.phone ?? ""}
              onChange={(e) => setContactDraft((d) => ({ ...d, phone: e.target.value }))}
              placeholder="טלפון"
              dir="ltr"
            />
          </div>
          <Select
            value={contactDraft.role_key}
            onValueChange={(v) => v && setContactDraft((d) => ({ ...d, role_key: v as EventContactRole }))}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue>{(v: string) => getRoleLabel(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(availableRoles.length ? availableRoles : (Object.keys(EVENT_CONTACT_ROLE_LABELS) as EventContactRole[])).map(
                (g) => (
                  <SelectItem key={g} value={g}>
                    {getRoleLabel(g)}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Input
            value={contactDraft.email ?? ""}
            onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="אימייל"
            type="email"
            dir="ltr"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              value={contactDraft.id_number ?? ""}
              onChange={(e) => setContactDraft((d) => ({ ...d, id_number: e.target.value }))}
              placeholder="ת.ז / ח.פ"
              dir="ltr"
            />
            <Input
              value={contactDraft.address ?? ""}
              onChange={(e) => setContactDraft((d) => ({ ...d, address: e.target.value }))}
              placeholder="כתובת"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
            ביטול
          </Button>
          <Button onClick={saveContact}>שמור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteContactTarget} onOpenChange={(o) => !o && setDeleteContactTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>להסיר את איש הקשר?</AlertDialogTitle>
          <AlertDialogDescription>הפעולה בלתי הפיכה.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmDeleteContact}>
            הסר
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={statusConfirmDialogOpen} onOpenChange={(o) => !o && setStatusConfirmDialogOpen(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>לשנות את הסטטוס?</AlertDialogTitle>
          <AlertDialogDescription>
            הליד יעבור מ&rdquo;סגור&rdquo; ל&rdquo;{pendingStatus ? STATUS_LABELS[pendingStatus] : ""}&rdquo;.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingStatus(null)}>ביטול</AlertDialogCancel>
          <AlertDialogAction onClick={confirmStatusChangeAsAdmin}>אישור</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={statusPinDialogOpen} onOpenChange={setStatusPinDialogOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>נדרש אישור מנהל</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          שינוי סטטוס מ&rdquo;סגור&rdquo; לסטטוס אחר דורש קוד אישור מנהל.
        </p>
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={4}
          autoFocus
          value={statusPinInput}
          onChange={(e) => setStatusPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitStatusPin())}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setStatusPinDialogOpen(false)}>
            ביטול
          </Button>
          <Button onClick={submitStatusPin}>אישור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteActivityTarget} onOpenChange={(o) => !o && setDeleteActivityTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>למחוק את התיעוד?</AlertDialogTitle>
          <AlertDialogDescription>הפעולה בלתי הפיכה.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmDeleteActivity}>
            מחק
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
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
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
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

function FieldRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2 text-[13px] first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-left">{children}</span>
    </div>
  );
}

function Chip({
  label,
  children,
  editable,
}: {
  label: string;
  children: React.ReactNode;
  editable?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-center",
        editable && "transition-colors hover:border-primary hover:bg-primary/5"
      )}
    >
      <p className="text-[10px] uppercase tracking-[.06em] text-muted-foreground">{label}</p>
      <div className="truncate text-[13px] font-semibold">{children}</div>
      {editable && (
        <Pencil className="absolute left-1.5 top-1.5 size-2.5 text-muted-foreground/50" />
      )}
    </div>
  );
}

/**
 * פרטי איש קשר בשורה אחת עם מפרידים, במקום רשימה אנכית שמאריכה את הכרטיס.
 * המפריד מרונדר כאלמנט נפרד (ולא כתו בתוך הטקסט) כדי שהוא לא ייבחר בהעתקה
 * ולא ייקרא ע"י קורא מסך.
 */
function ContactDetails({ contact, fallbackEmail }: { contact: EventContact; fallbackEmail?: string }) {
  const fields = [
    { label: "טלפון", value: contact.phone, ltr: true },
    { label: "מייל", value: contact.email ?? fallbackEmail, ltr: true },
    { label: "ת.ז", value: contact.id_number, ltr: true },
    { label: "כתובת", value: contact.address, ltr: false },
  ].filter((f) => f.value);

  if (fields.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
      {fields.map((f, i) => (
        <span key={f.label} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-border">|</span>}
          {/* הכתובת היא השדה היחיד שיכול להיות ארוך, ולכן רק היא מורשית לשבור
              שורה — טלפון/מייל/ת.ז נשארים שלמים. */}
          <span className={f.ltr ? "whitespace-nowrap" : "min-w-0"}>
            <span className="opacity-70">{f.label}:</span>{" "}
            <span dir={f.ltr ? "ltr" : undefined} className="font-medium text-foreground/80">
              {f.value}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

function ActivityRow({
  activityId,
  content,
  type,
  createdAt,
  userName,
  highlighted,
  editable,
  editing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  activityId: string;
  content: string;
  type: ActivityType;
  createdAt: string;
  userName?: string;
  highlighted: boolean;
  editable: boolean;
  editing: boolean;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = ACTIVITY_ICONS[type];

  if (editing) {
    return (
      <li className="grid gap-1.5 rounded-md border border-dashed border-border p-2">
        <Textarea
          autoFocus
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          rows={2}
          className="text-sm"
        />
        <div className="flex items-center gap-1.5">
          <Button size="icon-sm" variant="outline" onClick={onSaveEdit} aria-label="שמור">
            <Check className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="outline" onClick={onCancelEdit} aria-label="ביטול">
            <X className="size-3.5" />
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li
      id={`activity-${activityId}`}
      className={cn(
        "group flex gap-2.5 rounded-md",
        highlighted && "bg-primary/10 ring-1 ring-primary"
      )}
    >
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{content}</p>
        <p className="text-[11px] text-muted-foreground">
          [{formatDateTime(createdAt)}] [{userName}]
        </p>
      </div>
      {editable && (
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <Button size="icon-sm" variant="ghost" onClick={onStartEdit} aria-label="ערוך">
            <Pencil className="size-3" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label="מחק">
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      )}
    </li>
  );
}

/** הדף שמודפס להצעת התפריט לזוג — מנות נבחרות בלבד, מקובצות לפי קטגוריה. */
function MenuPrintable({
  ref,
  title,
  venueName,
  contacts,
  eventDate,
  startTime,
  guests,
  menuDishes,
  menuSelection,
  menuNotes,
}: {
  ref: React.Ref<HTMLDivElement>;
  title: string;
  venueName?: string;
  contacts: EventContact[];
  eventDate: string | null;
  startTime?: string;
  guests: number;
  menuDishes: MenuDish[];
  menuSelection?: Partial<Record<MenuCategory, string[]>>;
  menuNotes?: Record<string, string>;
}) {
  const contactsLine = contacts.map((c) => `${getRoleLabel(c.role_key)}: ${c.name}`).join("  |  ");
  const detailsLine = [
    eventDate ? `${formatDate(eventDate)} (${formatWeekday(eventDate)})` : null,
    startTime ? `שעה ${startTime}` : null,
    `${guests} מוזמנים`,
  ]
    .filter(Boolean)
    .join("  |  ");

  return (
    <div ref={ref} dir="rtl" className="w-[720px] bg-white p-8 text-neutral-900">
      <div className="mb-5 border-b border-neutral-800 pb-3 text-center">
        <h1 className="text-xl font-bold">תפריט האירוע — {title}</h1>
        {venueName && <p className="mt-1 text-[11px] text-neutral-500">{venueName}</p>}
        {contactsLine && <p className="mt-2 text-[11px]">{contactsLine}</p>}
        {detailsLine && <p className="mt-0.5 text-[11px] text-neutral-600">{detailsLine}</p>}
      </div>
      {MENU_CATEGORIES.map((cat) => {
        const dishIds = menuSelection?.[cat] ?? [];
        const dishes = dishIds
          .map((id) => menuDishes.find((d) => d.dish_id === id))
          .filter((d): d is MenuDish => !!d);
        if (dishes.length === 0) return null;
        return (
          <div key={cat} className="mb-5">
            <h2 className="mb-2 border-b border-neutral-300 pb-1 text-sm font-bold">{cat}</h2>
            <div className="grid gap-2">
              {dishes.map((dish) => (
                <div key={dish.dish_id}>
                  <p className="text-sm font-medium">{dish.name}</p>
                  {dish.description && <p className="text-[11px] text-neutral-600">{dish.description}</p>}
                  {menuNotes?.[dish.dish_id] && (
                    <p className="text-[11px] italic text-neutral-500">{menuNotes[dish.dish_id]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
