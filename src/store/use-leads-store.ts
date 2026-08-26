import { create } from "zustand";
import { toast } from "sonner";
import { collection, doc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import {
  MOCK_LEADS,
  MOCK_ACTIVITY,
  MOCK_TASKS,
  MOCK_CALENDAR_EVENTS,
  MOCK_CATALOG,
  MOCK_TASK_PRESETS,
  MOCK_EVENT_TYPES,
} from "@/lib/mock-data";
import type {
  LeadEvent,
  ActivityFeedItem,
  Task,
  CalendarEvent,
  CalendarEventType,
  PipelineStage,
  ActivityType,
  LeadStatus,
  DocumentRef,
  EventContact,
  EventPlanning,
  EventType,
  CartLineItem,
  CatalogItem,
  CatalogBundle,
  PaymentTemplate,
  LeadPaymentStep,
  TaskPreset,
  MeetingEntry,
  MeetingType,
  MenuServingStyle,
  MenuCategory,
  MenuDish,
  Ingredient,
  OrgFile,
  OrgFileFolder,
  OrgSupplier,
  PlanningPreset,
  PromisePreset,
  QuoteOptionalDate,
  CalendarNoteOverride,
  DateNote,
  DateNoteColor,
} from "@/lib/types";
import { MEETING_TYPE_LABELS } from "@/lib/types";
import type { OrgContractFile } from "@/lib/firebase/use-org-doc";
import type { OrgRole, PermissionAreaKey, PermissionLevel } from "@/lib/firebase/types";
import { getEventTitle, formatCurrency } from "@/lib/format";
import { CURRENT_USER } from "@/lib/mock-data";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";

let leadCounter = MOCK_LEADS.length + 1;
let activityCounter = MOCK_ACTIVITY.length + 1;
let taskCounter = MOCK_TASKS.length + 1;
let calendarEventCounter = MOCK_CALENDAR_EVENTS.length + 1;
let catalogCounter = MOCK_CATALOG.length + 1;
let taskPresetCounter = MOCK_TASK_PRESETS.length + 1;
let eventTypeCounter = MOCK_EVENT_TYPES.length + 1;
let meetingCounter = 1;
let dateNoteCounter = 1;
let promisePresetCounter = 1;
let orgFileCounter = 1;
let orgFileFolderCounter = 1;
let orgSupplierCounter = 1;
let catalogBundleCounter = 1;
let paymentTemplateCounter = 1;
let planningPresetCounter = 1;
let menuDishCounter = 1;
let ingredientCounter = 1;

function randomToken(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

export const EVENT_TYPE_COLOR_PALETTE = [
  "#D4537E", "#BA7517", "#378ADD", "#1D9E75", "#5F5E5A", "#7F77DD", "#D85A30", "#639922",
];
let contactCounter = 1;

function combineDateAndTime(dateIso: string, time?: string): string {
  if (!time) return dateIso;
  const d = new Date(dateIso);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// אירוע "סגור" עם תאריך מקבל אוטומטית רשומה ביומן (confirmed_event), כדי
// שהיומן לא ידרוש הוספה ידנית כפולה. נקרא אחרי updateLeadStatus/
// updateLeadSchedule — מוחק רשומות קודמות של הליד ויוצר מחדש לפי המצב הנוכחי.
function syncCalendarForLead(leadId: string) {
  const state = useLeadsStore.getState();
  const lead = state.leads.find((l) => l.lead_id === leadId);
  if (!lead) return;

  // סטטוס הליד השתנה (זו נקודת הכניסה היחידה שקוראת ל-syncCalendarForLead) —
  // כל מטלת מעקב על שריון תאריך פתוח לליד הזה כבר לא רלוונטית.
  completeLinkedTasks((t) => t.lead_id === leadId && !!t.linked_calendar_event_id);

  const previous = state.calendarEvents.filter(
    (e) => e.lead_id === leadId && e.event_type === "confirmed_event"
  );
  const others = state.calendarEvents.filter(
    (e) => !(e.lead_id === leadId && e.event_type === "confirmed_event")
  );

  // רשומות שהוסרו מה-state חייבות להימחק גם מ-Firestore, אחרת הן חוזרות
  // בטעינה הבאה — וכשהליד נסגר שוב נוצר מזהה חדש, מה שמייצר אירוע כפול.
  const dropStale = (keepId?: string) => {
    if (!isFirebaseConfigured || !state.orgId) return;
    for (const e of previous) {
      if (e.calendar_event_id === keepId) continue;
      deleteDoc(doc(db!, "organizations", state.orgId, "calendarEvents", e.calendar_event_id));
    }
  };

  if (lead.status !== "closed" || !lead.event_date) {
    dropStale();
    useLeadsStore.setState({ calendarEvents: others });
    return;
  }

  const startTime = combineDateAndTime(lead.event_date, lead.event_start_time);
  const endTime = combineDateAndTime(lead.event_date, lead.event_end_time ?? lead.event_start_time);
  const existing = previous[0];
  dropStale(existing?.calendar_event_id);
  const calendarEventId =
    existing?.calendar_event_id ??
    (isFirebaseConfigured && state.orgId
      ? doc(collection(db!, "organizations", state.orgId, "calendarEvents")).id
      : `c${calendarEventCounter++}`);

  const newEvent: CalendarEvent = {
    calendar_event_id: calendarEventId,
    lead_id: leadId,
    event_type: "confirmed_event",
    start_time: startTime,
    end_time: endTime,
    created_by_user_id: state.currentUserId,
  };
  useLeadsStore.setState({ calendarEvents: [...others, newEvent] });
  if (isFirebaseConfigured && state.orgId) {
    setDoc(doc(db!, "organizations", state.orgId, "calendarEvents", calendarEventId), { ...newEvent });
  }
}

// כל פגישה עם תאריך מקבלת רשומה משלה ביומן (event_type "meeting", מקושרת
// דרך meeting_id) — בשונה מ-syncCalendarForLead שמנהל רשומה יחידה לליד,
// כאן יכולות להיות כמה רשומות פעילות בו-זמנית לאותו ליד.
function syncMeetingCalendarEvent(leadId: string, meeting: MeetingEntry) {
  const state = useLeadsStore.getState();
  const previous = state.calendarEvents.filter((e) => e.meeting_id === meeting.meeting_id);
  const others = state.calendarEvents.filter((e) => e.meeting_id !== meeting.meeting_id);

  // כמו ב-syncCalendarForLead: מה שיורד מה-state חייב לרדת גם מ-Firestore,
  // אחרת הרשומה חוזרת בטעינה הבאה ומייצרת כפילות.
  const dropStale = (keepId?: string) => {
    if (!isFirebaseConfigured || !state.orgId) return;
    for (const e of previous) {
      if (e.calendar_event_id === keepId) continue;
      deleteDoc(doc(db!, "organizations", state.orgId, "calendarEvents", e.calendar_event_id));
    }
  };

  if (!meeting.date) {
    dropStale();
    useLeadsStore.setState({ calendarEvents: others });
    return;
  }

  const startTime = combineDateAndTime(meeting.date, meeting.time ?? "09:00");
  const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
  const existing = previous[0];
  dropStale(existing?.calendar_event_id);
  const calendarEventId =
    existing?.calendar_event_id ??
    (isFirebaseConfigured && state.orgId
      ? doc(collection(db!, "organizations", state.orgId, "calendarEvents")).id
      : `c${calendarEventCounter++}`);

  const newEvent: CalendarEvent = {
    calendar_event_id: calendarEventId,
    lead_id: leadId,
    event_type: "meeting",
    meeting_id: meeting.meeting_id,
    start_time: startTime,
    end_time: endTime,
    created_by_user_id: state.currentUserId,
  };
  useLeadsStore.setState({ calendarEvents: [...others, newEvent] });
  if (isFirebaseConfigured && state.orgId) {
    setDoc(doc(db!, "organizations", state.orgId, "calendarEvents", calendarEventId), { ...newEvent });
  }
}

function removeMeetingCalendarEvent(meetingId: string) {
  const state = useLeadsStore.getState();
  const target = state.calendarEvents.find((e) => e.meeting_id === meetingId);
  const others = state.calendarEvents.filter((e) => e.meeting_id !== meetingId);
  useLeadsStore.setState({ calendarEvents: others });
  if (target && isFirebaseConfigured && state.orgId) {
    deleteDoc(doc(db!, "organizations", state.orgId, "calendarEvents", target.calendar_event_id));
  }
}

// סוגר אוטומטית מטלות מעקב שנוצרו עם שריון תאריך (option_hold) — כשהשריון
// עצמו הוסר, או כשסטטוס הליד השתנה (השריון הפך למיותר, בין אם התאריך ננעל
// כאירוע סגור ובין אם הליד נפתח/בוטל).
function completeLinkedTasks(predicate: (t: Task) => boolean) {
  const state = useLeadsStore.getState();
  const now = new Date().toISOString();
  let changed = false;
  const nextTasks = state.tasks.map((t) => {
    if (t.is_completed || !predicate(t)) return t;
    changed = true;
    return { ...t, is_completed: true, completed_at: now, completed_by_user_id: state.currentUserId };
  });
  if (!changed) return;
  useLeadsStore.setState({ tasks: nextTasks });
  if (isFirebaseConfigured && state.orgId) {
    for (const t of nextTasks) {
      if (predicate(t) && t.completed_at === now) {
        updateDoc(doc(db!, "organizations", state.orgId, "tasks", t.task_id), {
          is_completed: true,
          completed_at: now,
          completed_by_user_id: state.currentUserId,
        });
      }
    }
  }
}

function sameDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Firestore rejects `undefined` field values — strip them before writing
// (local mock objects may carry them, e.g. optional email/phone_secondary).
// עמוק ולא רק שכבה ראשונה: Firestore זורק חריגה סינכרונית אם שדה undefined
// מופיע בכל עומק (כולל בתוך מערכים/אובייקטים מקוננים כמו contacts), ולא רק
// ברמה העליונה.
function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefinedDeep(v)])
    );
  }
  return value;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return stripUndefinedDeep(obj) as T;
}

interface LeadsState {
  // Multi-tenant session, bridged in from OrgProvider by <FirestoreSync>.
  // When orgId is null (demo mode / Firebase not configured), every action
  // below only touches the local in-memory mock arrays.
  orgId: string | null;
  currentUserId: string;
  currentUserName: string;
  setSession: (orgId: string | null, userId: string, userName: string) => void;

  leads: LeadEvent[];
  activity: ActivityFeedItem[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  catalog: CatalogItem[];
  catalogBundles: CatalogBundle[];
  paymentTemplates: PaymentTemplate[];
  taskPresets: TaskPreset[];
  eventTypes: EventType[];
  promisePresets: PromisePreset[];
  orgFiles: OrgFile[];
  orgFileFolders: OrgFileFolder[];
  orgSuppliers: OrgSupplier[];
  planningPresets: PlanningPreset[];
  menuDishes: MenuDish[];
  ingredients: Ingredient[];
  calendarNoteOverrides: CalendarNoteOverride[];
  dateNotes: DateNote[];

  // ה-PIN-ים למחיקת כרטיס אירוע כבר לא נשמרים כאן: הם יושבים כ-hash
  // ב-private/security ומאומתים רק בשרת (deleteLeadSecure / verifyDeletePin).
  hydrateLeads: (leads: LeadEvent[]) => void;
  hydrateActivity: (activity: ActivityFeedItem[]) => void;
  hydrateTasks: (tasks: Task[]) => void;
  hydrateCalendarEvents: (events: CalendarEvent[]) => void;
  hydrateCalendarNoteOverrides: (overrides: CalendarNoteOverride[]) => void;
  /** text=null מסתיר את תווית ההיתר לתאריך הזה; מחרוזת = טקסט חלופי. */
  setCalendarNoteOverride: (date: string, text: string | null) => void;
  hydrateDateNotes: (notes: DateNote[]) => void;
  addDateNote: (date: string, text: string, color: DateNoteColor) => void;
  updateDateNote: (noteId: string, text: string, color: DateNoteColor) => void;
  deleteDateNote: (noteId: string) => void;
  hydrateCatalog: (catalog: CatalogItem[]) => void;
  hydrateCatalogBundles: (bundles: CatalogBundle[]) => void;
  hydratePaymentTemplates: (templates: PaymentTemplate[]) => void;
  hydrateTaskPresets: (presets: TaskPreset[]) => void;
  hydrateEventTypes: (types: EventType[]) => void;
  hydratePromisePresets: (presets: PromisePreset[]) => void;
  hydrateOrgFiles: (files: OrgFile[]) => void;
  hydrateOrgFileFolders: (folders: OrgFileFolder[]) => void;
  hydrateOrgSuppliers: (suppliers: OrgSupplier[]) => void;
  hydratePlanningPresets: (presets: PlanningPreset[]) => void;
  hydrateMenuDishes: (dishes: MenuDish[]) => void;
  hydrateIngredients: (ingredients: Ingredient[]) => void;

  addCatalogItem: (item: Omit<CatalogItem, "item_id">) => void;
  updateCatalogItem: (itemId: string, updates: Partial<Omit<CatalogItem, "item_id">>) => void;
  deleteCatalogItem: (itemId: string) => void;

  addCatalogBundle: (bundle: Omit<CatalogBundle, "bundle_id">) => void;
  updateCatalogBundle: (bundleId: string, updates: Partial<Omit<CatalogBundle, "bundle_id">>) => void;
  deleteCatalogBundle: (bundleId: string) => void;

  addPaymentTemplate: (template: Omit<PaymentTemplate, "template_id">) => void;
  updatePaymentTemplate: (templateId: string, updates: Partial<Omit<PaymentTemplate, "template_id">>) => void;
  deletePaymentTemplate: (templateId: string) => void;

  addTaskPreset: (title: string) => void;
  updateTaskPreset: (presetId: string, title: string) => void;
  deleteTaskPreset: (presetId: string) => void;

  addPromisePreset: (eventTypeNames: string[], text: string) => void;
  updatePromisePreset: (presetId: string, updates: Partial<Pick<PromisePreset, "event_type_names" | "text">>) => void;
  deletePromisePreset: (presetId: string) => void;

  addOrgFile: (file: Omit<OrgFile, "file_id" | "uploaded_at" | "uploaded_by_user_id">) => OrgFile;
  updateOrgFile: (fileId: string, updates: Partial<Pick<OrgFile, "name" | "tag" | "folder_id">>) => void;
  deleteOrgFile: (fileId: string) => void;

  addOrgFileFolder: (name: string, parentFolderId?: string | null) => void;
  updateOrgFileFolder: (folderId: string, updates: Partial<Pick<OrgFileFolder, "name">>) => void;
  deleteOrgFileFolder: (folderId: string) => void;
  addOrgSupplier: (supplier: Omit<OrgSupplier, "supplier_id" | "created_at">) => void;
  updateOrgSupplier: (supplierId: string, updates: Partial<Omit<OrgSupplier, "supplier_id" | "created_at">>) => void;
  deleteOrgSupplier: (supplierId: string) => void;
  addPlanningPreset: (preset: Omit<PlanningPreset, "preset_id" | "created_at">) => void;
  updatePlanningPreset: (presetId: string, updates: Partial<Omit<PlanningPreset, "preset_id" | "created_at">>) => void;
  deletePlanningPreset: (presetId: string) => void;

  addMenuDish: (dish: Omit<MenuDish, "dish_id">) => void;
  updateMenuDish: (dishId: string, updates: Partial<Omit<MenuDish, "dish_id">>) => void;
  deleteMenuDish: (dishId: string) => void;

  addIngredient: (ingredient: Omit<Ingredient, "id" | "created_at">) => void;
  updateIngredient: (ingredientId: string, updates: Partial<Omit<Ingredient, "id">>) => void;
  deleteIngredient: (ingredientId: string) => void;

  updateLeadStaffing: (
    leadId: string,
    staffing: { staff_count?: number; staff_hours?: number; staff_hourly_rate?: number }
  ) => void;
  setMenuCategoryLimit: (category: MenuCategory, limit: number) => void;
  updateLeadMenuSelection: (leadId: string, category: MenuCategory, dishIds: string[]) => void;
  setLeadMenuDishNote: (leadId: string, dishId: string, note: string) => void;
  setLeadMenuLocked: (leadId: string, locked: boolean) => void;

  setOrgLogo: (url: string) => void;
  setOrgContractLegalText: (text: string) => void;
  addOrgContractFile: (file: OrgContractFile) => void;
  removeOrgContractFile: (file: OrgContractFile) => void;
  setOrgLeadSources: (sources: string[]) => void;
  setOrgVenueDetails: (details: {
    name?: string;
    companyId?: string;
    website?: string;
    venueAddress?: string;
    venuePhone?: string;
    venueEmail?: string;
    senderEmail?: string;
    notifyNewLeadEmail?: boolean;
    notifyNewLeadWhatsapp?: boolean;
  }) => void;
  setLeadQuoteOptionalDates: (leadId: string, dates: QuoteOptionalDate[]) => void;

  addEventType: (name: string, roleKeys: EventType["role_keys"], ownerUserId?: string | null) => void;
  updateEventType: (typeId: string, updates: Partial<Omit<EventType, "event_type_id">>) => void;
  deleteEventType: (typeId: string) => void;

  addLead: (
    data: Omit<Partial<LeadEvent>, "event_type_id" | "contacts" | "custom_title"> & {
      event_type_id: string;
      contacts: Omit<EventContact, "contact_id">[];
      custom_title?: string | null;
    }
  ) => LeadEvent;
  updateLeadContacts: (
    leadId: string,
    contacts: EventContact[],
    customTitle?: string | null
  ) => void;
  updateLeadCart: (leadId: string, cart: CartLineItem[]) => void;
  addCartItems: (leadId: string, itemIds: string[]) => void;
  updateCartLine: (
    leadId: string,
    itemId: string,
    patch: Partial<Pick<CartLineItem, "quantity" | "price_override" | "vat_mode">>
  ) => void;
  removeCartItem: (leadId: string, itemId: string) => void;
  setCartLocked: (leadId: string, locked: boolean) => void;
  setOrgVatPercent: (percent: number) => void;
  setOrgDepositSettings: (mode: "percent" | "fixed", value: number) => void;
  setOrgFoodCostSettings: (monthlyOverhead: number, monthlyGuestForecast: number) => void;
  setOrgRoleDefaultPermission: (role: OrgRole, area: PermissionAreaKey, level: PermissionLevel) => void;
  updateLeadVenue: (leadId: string, venue: string) => void;
  updateLeadGuests: (leadId: string, guests: number) => void;
  updateLeadEventType: (leadId: string, eventTypeId: string) => void;
  setLeadDepositOverride: (
    leadId: string,
    override: { mode: "percent" | "fixed"; value: number } | null
  ) => void;
  updateLeadPhoto: (leadId: string, photoUrl: string) => void;
  updateLeadStage: (leadId: string, stage: PipelineStage) => void;
  updateLeadSchedule: (
    leadId: string,
    schedule: { event_date: string | null; event_start_time?: string; event_end_time?: string }
  ) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  closeLeadEvent: (
    leadId: string,
    details: {
      event_date: string;
      event_start_time: string;
      event_end_time: string;
      event_day_part: "morning" | "evening";
      estimated_guests: number;
      serving_style: MenuServingStyle;
    }
  ) => void;
  syncLeadCalendar: (leadId: string) => void;
  toggleMilestone: (leadId: string, key: string) => void;
  setFollowUp: (leadId: string, iso: string | null) => void;
  setPromises: (leadId: string, promises: string) => void;
  setLeadPaymentSchedule: (leadId: string, steps: LeadPaymentStep[]) => void;
  markPaymentStepPaid: (leadId: string, stepId: string, paid: boolean) => void;
  setFirstInquiry: (leadId: string, iso: string | null) => void;
  setLostReason: (leadId: string, reason: string | null) => void;
  addActivity: (
    leadId: string,
    type: ActivityType,
    content: string,
    participantIds?: string[]
  ) => void;
  /** תיעוד שנוצר אוטומטית (שליחה, עדכון פרטים, שינוי סטטוס) — מופרד בכרטיס לטאב "מערכת". */
  addSystemActivity: (leadId: string, type: ActivityType, content: string) => void;
  updateActivity: (activityId: string, content: string) => void;
  deleteActivity: (activityId: string) => void;

  addMeeting: (
    leadId: string,
    type: MeetingType,
    date: string | null,
    time?: string | null,
    notes?: string
  ) => void;
  cancelMeeting: (leadId: string, meetingId: string) => void;
  rescheduleMeeting: (leadId: string, meetingId: string, date: string | null, time?: string | null) => void;
  deleteMeeting: (leadId: string, meetingId: string) => void;
  addTask: (task: Omit<Task, "task_id" | "is_completed" | "created_at">) => void;
  deleteTask: (taskId: string) => void;
  updateTask: (taskId: string, updates: Partial<Pick<Task, "title" | "due_date">>) => void;
  toggleTask: (taskId: string) => void;

  checkDateCollision: (
    date: string,
    excludeLeadId?: string
  ) => CalendarEvent | undefined;
  addCalendarEvent: (
    leadId: string,
    eventType: CalendarEventType,
    startTime: string,
    endTime: string,
    force?: boolean
  ) => { success: boolean; conflict?: CalendarEvent };
  updateCalendarEvent: (
    calendarEventId: string,
    eventType: CalendarEventType,
    startTime: string,
    endTime: string,
    force?: boolean
  ) => { success: boolean; conflict?: CalendarEvent };
  deleteCalendarEvent: (calendarEventId: string) => void;
  /**
   * שריון תאריך (option_hold) עם תוקף — בנוסף לרשומת היומן, רושם פעילות
   * בכרטיס הליד ויוצר מטלת מעקב (assigned למשתמש הנוכחי, due_date=expiresAt)
   * שנסגרת אוטומטית כשהשריון מוסר או כשסטטוס הליד משתנה.
   */
  reserveDate: (
    leadId: string,
    startTime: string,
    endTime: string,
    expiresAt: string,
    force?: boolean
  ) => { success: boolean; conflict?: CalendarEvent };
  addDocument: (leadId: string, doc: Omit<DocumentRef, "doc_id" | "created_at" | "created_by_user_id">) => void;
  renameDocument: (leadId: string, docId: string, name: string) => void;
  setDocumentShortUrl: (leadId: string, docId: string, shortUrl: string) => void;
  updateLeadPlanning: (leadId: string, planning: EventPlanning) => void;
  deleteDocument: (leadId: string, docId: string) => void;
  markDepositPaid: (leadId: string) => void;

  deleteLead: (leadId: string) => void;
}

/**
 * גוף משותף ל-addActivity ול-addSystemActivity. ההפרדה היא רק בדגל is_system,
 * שקובע לאיזה טאב הרשומה נכנסת בכרטיס האירוע.
 */
function addActivityInternal(
  get: () => LeadsState,
  set: (partial: (state: LeadsState) => Partial<LeadsState>) => void,
  leadId: string,
  type: ActivityType,
  content: string,
  participantIds: string[] | undefined,
  isSystem: boolean
) {
  const { orgId, currentUserId } = get();
  const activityId =
    isFirebaseConfigured && orgId
      ? doc(collection(db!, "organizations", orgId, "activity")).id
      : `a${activityCounter++}`;

  const newActivity: ActivityFeedItem = {
    activity_id: activityId,
    lead_id: leadId,
    user_id: currentUserId,
    activity_type: type,
    content,
    created_at: new Date().toISOString(),
    ...(participantIds && participantIds.length > 0 ? { participant_ids: participantIds } : {}),
    ...(isSystem ? { is_system: true } : {}),
  };
  set((state) => ({ activity: [newActivity, ...state.activity] }));
  if (isFirebaseConfigured && orgId) {
    setDoc(doc(db!, "organizations", orgId, "activity", activityId), stripUndefined({ ...newActivity }));
  }
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  orgId: null,
  currentUserId: CURRENT_USER.user_id,
  currentUserName: CURRENT_USER.full_name,
  setSession: (orgId, userId, userName) =>
    set({ orgId, currentUserId: userId, currentUserName: userName }),

  // כשFirebase מחובר, ה-state מתחיל ריק ומתמלא אך ורק דרך ה-listeners של
  // FirestoreSync — נתוני ה-MOCK משמשים רק במצב דמו (בלי Firebase). בעבר
  // ה-state תמיד התחיל עם MOCK_LEADS וכו', כך שבכל טעינת דף היה הבזק קצר של
  // הנתונים המדומים (זוגות דמו) עד שה-snapshot הראשון מ-Firestore הגיע.
  leads: isFirebaseConfigured ? [] : MOCK_LEADS,
  activity: isFirebaseConfigured ? [] : MOCK_ACTIVITY,
  tasks: isFirebaseConfigured ? [] : MOCK_TASKS,
  calendarEvents: isFirebaseConfigured ? [] : MOCK_CALENDAR_EVENTS,
  catalog: isFirebaseConfigured ? [] : MOCK_CATALOG,
  catalogBundles: [],
  paymentTemplates: [],
  taskPresets: isFirebaseConfigured ? [] : MOCK_TASK_PRESETS,
  eventTypes: isFirebaseConfigured ? [] : MOCK_EVENT_TYPES,
  promisePresets: [],
  orgFiles: [],
  orgFileFolders: [],
  orgSuppliers: [],
  planningPresets: [],
  menuDishes: [],
  ingredients: [],
  calendarNoteOverrides: [],
  dateNotes: [],

  hydrateLeads: (leads) => set({ leads }),
  hydrateActivity: (activity) => set({ activity }),
  hydrateTasks: (tasks) => set({ tasks }),
  // ניקוי כפילויות שנוצרו לפני שסנכרון היומן התחיל למחוק רשומות ישנות
  // מ-Firestore: לכל ליד יש לכל היותר confirmed_event אחד, ולכל פגישה רשומה אחת.
  hydrateCalendarEvents: (calendarEvents) => {
    const seen = new Set<string>();
    const deduped = calendarEvents.filter((e) => {
      const key =
        e.event_type === "confirmed_event"
          ? `confirmed:${e.lead_id}`
          : e.meeting_id
            ? `meeting:${e.meeting_id}`
            : null;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    set({ calendarEvents: deduped });
  },
  hydrateCalendarNoteOverrides: (calendarNoteOverrides) => set({ calendarNoteOverrides }),
  setCalendarNoteOverride: (date, text) => {
    const { orgId } = get();
    set((state) => ({
      calendarNoteOverrides: [
        ...state.calendarNoteOverrides.filter((o) => o.date !== date),
        { date, text },
      ],
    }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "calendarNoteOverrides", date), { date, text });
    }
  },
  hydrateDateNotes: (dateNotes) => set({ dateNotes }),
  addDateNote: (date, text, color) => {
    const { orgId } = get();
    const noteId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "dateNotes")).id
        : `dn${dateNoteCounter++}`;
    const newNote: DateNote = { note_id: noteId, date, text, color };
    set((state) => ({ dateNotes: [...state.dateNotes, newNote] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "dateNotes", noteId), { date, text, color });
    }
  },
  updateDateNote: (noteId, text, color) => {
    const { orgId } = get();
    set((state) => ({
      dateNotes: state.dateNotes.map((n) => (n.note_id === noteId ? { ...n, text, color } : n)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "dateNotes", noteId), { text, color });
    }
  },
  deleteDateNote: (noteId) => {
    const { orgId } = get();
    set((state) => ({ dateNotes: state.dateNotes.filter((n) => n.note_id !== noteId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "dateNotes", noteId));
    }
  },
  hydrateCatalog: (catalog) =>
    set({ catalog: [...catalog].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }),
  hydrateCatalogBundles: (catalogBundles) => set({ catalogBundles }),
  hydratePaymentTemplates: (paymentTemplates) => set({ paymentTemplates }),
  hydrateTaskPresets: (taskPresets) => set({ taskPresets }),
  hydrateEventTypes: (eventTypes) =>
    set({ eventTypes: [...eventTypes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }),
  hydratePromisePresets: (presets) =>
    set({
      promisePresets: presets.map((p) => ({
        ...p,
        event_type_names: p.event_type_names?.length ? p.event_type_names : p.event_type_name ? [p.event_type_name] : [],
      })),
    }),
  hydrateOrgFiles: (orgFiles) => set({ orgFiles }),
  hydrateOrgFileFolders: (orgFileFolders) => set({ orgFileFolders }),
  hydrateOrgSuppliers: (orgSuppliers) => set({ orgSuppliers }),
  hydratePlanningPresets: (planningPresets) => set({ planningPresets }),
  hydrateMenuDishes: (menuDishes) =>
    set({ menuDishes: [...menuDishes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }),
  hydrateIngredients: (ingredients) => set({ ingredients }),

  addEventType: (name, roleKeys, ownerUserId) => {
    const { orgId, eventTypes } = get();
    const typeId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "eventTypes")).id
        : `et${eventTypeCounter++}`;
    const newType: EventType = {
      event_type_id: typeId,
      name,
      role_keys: roleKeys,
      owner_user_id: ownerUserId ?? null,
      color: EVENT_TYPE_COLOR_PALETTE[eventTypes.length % EVENT_TYPE_COLOR_PALETTE.length],
    };
    set((state) => ({ eventTypes: [...state.eventTypes, newType] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "eventTypes", typeId), stripUndefined({ ...newType })).catch(
        (err) => toast.error(`שמירת סוג האירוע נכשלה: ${err.message}`)
      );
    }
  },

  updateEventType: (typeId, updates) => {
    const { orgId } = get();
    set((state) => ({
      eventTypes: state.eventTypes.map((t) => (t.event_type_id === typeId ? { ...t, ...updates } : t)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "eventTypes", typeId), stripUndefined({ ...updates })).catch(
        (err) => toast.error(`עדכון סוג האירוע נכשל: ${err.message}`)
      );
    }
  },

  deleteEventType: (typeId) => {
    const { orgId } = get();
    set((state) => ({ eventTypes: state.eventTypes.filter((t) => t.event_type_id !== typeId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "eventTypes", typeId));
    }
  },

  addTaskPreset: (title) => {
    const { orgId, currentUserId } = get();
    const presetId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "taskPresets")).id
        : `tp${taskPresetCounter++}`;
    const newPreset: TaskPreset = { preset_id: presetId, title, created_by_user_id: currentUserId };
    set((state) => ({ taskPresets: [...state.taskPresets, newPreset] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "taskPresets", presetId), stripUndefined({ ...newPreset }));
    }
  },

  updateTaskPreset: (presetId, title) => {
    const { orgId } = get();
    set((state) => ({
      taskPresets: state.taskPresets.map((p) => (p.preset_id === presetId ? { ...p, title } : p)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "taskPresets", presetId), { title });
    }
  },

  deleteTaskPreset: (presetId) => {
    const { orgId } = get();
    set((state) => ({ taskPresets: state.taskPresets.filter((p) => p.preset_id !== presetId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "taskPresets", presetId));
    }
  },

  addPromisePreset: (eventTypeNames, text) => {
    const { orgId } = get();
    const presetId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "promisePresets")).id
        : `pp${promisePresetCounter++}`;
    const newPreset: PromisePreset = { preset_id: presetId, event_type_names: eventTypeNames, text };
    set((state) => ({ promisePresets: [...state.promisePresets, newPreset] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "promisePresets", presetId), stripUndefined({ ...newPreset }));
    }
  },

  updatePromisePreset: (presetId, updates) => {
    const { orgId } = get();
    set((state) => ({
      promisePresets: state.promisePresets.map((p) => (p.preset_id === presetId ? { ...p, ...updates } : p)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "promisePresets", presetId), stripUndefined({ ...updates }));
    }
  },

  deletePromisePreset: (presetId) => {
    const { orgId } = get();
    set((state) => ({ promisePresets: state.promisePresets.filter((p) => p.preset_id !== presetId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "promisePresets", presetId));
    }
  },

  addOrgFile: (file) => {
    const { orgId, currentUserId } = get();
    const fileId =
      isFirebaseConfigured && orgId ? doc(collection(db!, "organizations", orgId, "orgFiles")).id : `of${orgFileCounter++}`;
    const newFile: OrgFile = {
      ...file,
      file_id: fileId,
      uploaded_at: new Date().toISOString(),
      uploaded_by_user_id: currentUserId,
    };
    set((state) => ({ orgFiles: [newFile, ...state.orgFiles] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "orgFiles", fileId), stripUndefined({ ...newFile }));
    }
    return newFile;
  },

  updateOrgFile: (fileId, updates) => {
    const { orgId } = get();
    set((state) => ({
      orgFiles: state.orgFiles.map((f) => (f.file_id === fileId ? { ...f, ...updates } : f)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "orgFiles", fileId), stripUndefined({ ...updates }));
    }
  },

  deleteOrgFile: (fileId) => {
    const { orgId } = get();
    set((state) => ({ orgFiles: state.orgFiles.filter((f) => f.file_id !== fileId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "orgFiles", fileId));
    }
  },

  addOrgFileFolder: (name, parentFolderId) => {
    const { orgId } = get();
    const folderId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "orgFileFolders")).id
        : `off${orgFileFolderCounter++}`;
    const newFolder: OrgFileFolder = {
      folder_id: folderId,
      name,
      parent_folder_id: parentFolderId ?? null,
      created_at: new Date().toISOString(),
    };
    set((state) => ({ orgFileFolders: [...state.orgFileFolders, newFolder] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "orgFileFolders", folderId), stripUndefined({ ...newFolder }));
    }
  },

  updateOrgFileFolder: (folderId, updates) => {
    const { orgId } = get();
    set((state) => ({
      orgFileFolders: state.orgFileFolders.map((f) => (f.folder_id === folderId ? { ...f, ...updates } : f)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "orgFileFolders", folderId), stripUndefined({ ...updates }));
    }
  },

  deleteOrgFileFolder: (folderId) => {
    const { orgId } = get();
    set((state) => ({ orgFileFolders: state.orgFileFolders.filter((f) => f.folder_id !== folderId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "orgFileFolders", folderId));
    }
  },

  addOrgSupplier: (supplier) => {
    const { orgId } = get();
    const supplierId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "orgSuppliers")).id
        : `os${orgSupplierCounter++}`;
    const newSupplier: OrgSupplier = {
      ...supplier,
      supplier_id: supplierId,
      created_at: new Date().toISOString(),
    };
    set((state) => ({ orgSuppliers: [newSupplier, ...state.orgSuppliers] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "orgSuppliers", supplierId), stripUndefined({ ...newSupplier }));
    }
  },

  updateOrgSupplier: (supplierId, updates) => {
    const { orgId } = get();
    set((state) => ({
      orgSuppliers: state.orgSuppliers.map((s) =>
        s.supplier_id === supplierId ? { ...s, ...updates } : s
      ),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "orgSuppliers", supplierId), stripUndefined({ ...updates }));
    }
  },

  deleteOrgSupplier: (supplierId) => {
    const { orgId } = get();
    set((state) => ({ orgSuppliers: state.orgSuppliers.filter((s) => s.supplier_id !== supplierId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "orgSuppliers", supplierId));
    }
  },

  addPlanningPreset: (preset) => {
    const { orgId } = get();
    const presetId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "planningPresets")).id
        : `pp${planningPresetCounter++}`;
    const newPreset: PlanningPreset = {
      ...preset,
      preset_id: presetId,
      created_at: new Date().toISOString(),
    };
    set((state) => ({ planningPresets: [newPreset, ...state.planningPresets] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "planningPresets", presetId), stripUndefined({ ...newPreset }));
    }
  },

  updatePlanningPreset: (presetId, updates) => {
    const { orgId } = get();
    set((state) => ({
      planningPresets: state.planningPresets.map((p) =>
        p.preset_id === presetId ? { ...p, ...updates } : p
      ),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "planningPresets", presetId), stripUndefined({ ...updates }));
    }
  },

  deletePlanningPreset: (presetId) => {
    const { orgId } = get();
    set((state) => ({ planningPresets: state.planningPresets.filter((p) => p.preset_id !== presetId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "planningPresets", presetId));
    }
  },

  addMenuDish: (dish) => {
    const { orgId, menuDishes } = get();
    const dishId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "menuDishes")).id
        : `md${menuDishCounter++}`;
    const newDish: MenuDish = { ...dish, dish_id: dishId, sort_order: dish.sort_order ?? menuDishes.length };
    set((state) => ({ menuDishes: [...state.menuDishes, newDish] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "menuDishes", dishId), stripUndefined({ ...newDish }));
    }
  },

  updateMenuDish: (dishId, updates) => {
    const { orgId } = get();
    set((state) => ({
      menuDishes: state.menuDishes.map((d) => (d.dish_id === dishId ? { ...d, ...updates } : d)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "menuDishes", dishId), stripUndefined({ ...updates }));
    }
  },

  deleteMenuDish: (dishId) => {
    const { orgId } = get();
    set((state) => ({ menuDishes: state.menuDishes.filter((d) => d.dish_id !== dishId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "menuDishes", dishId));
    }
  },

  addIngredient: (ingredient) => {
    const { orgId } = get();
    const ingredientId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "ingredients")).id
        : `ing${ingredientCounter++}`;
    const newIngredient: Ingredient = { ...ingredient, id: ingredientId, created_at: new Date().toISOString() };
    set((state) => ({ ingredients: [...state.ingredients, newIngredient] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "ingredients", ingredientId), stripUndefined({ ...newIngredient }));
    }
  },

  updateIngredient: (ingredientId, updates) => {
    const { orgId } = get();
    set((state) => ({
      ingredients: state.ingredients.map((i) => (i.id === ingredientId ? { ...i, ...updates } : i)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "ingredients", ingredientId), stripUndefined({ ...updates }));
    }
  },

  deleteIngredient: (ingredientId) => {
    const { orgId } = get();
    set((state) => ({ ingredients: state.ingredients.filter((i) => i.id !== ingredientId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "ingredients", ingredientId));
    }
  },

  updateLeadStaffing: (leadId, staffing) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, ...staffing } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), stripUndefined({ ...staffing }));
    }
  },

  setMenuCategoryLimit: (category, limit) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { [`menuCategoryLimits.${category}`]: limit });
    }
  },

  updateLeadMenuSelection: (leadId, category, dishIds) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) =>
        l.lead_id === leadId
          ? { ...l, menu_selection: { ...l.menu_selection, [category]: dishIds } }
          : l
      ),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), {
        [`menu_selection.${category}`]: dishIds,
      });
    }
  },

  setLeadMenuDishNote: (leadId, dishId, note) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) =>
        l.lead_id === leadId ? { ...l, menu_selection_notes: { ...l.menu_selection_notes, [dishId]: note } } : l
      ),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), {
        [`menu_selection_notes.${dishId}`]: note,
      });
    }
  },

  setLeadMenuLocked: (leadId, locked) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, menu_locked: locked } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { menu_locked: locked });
    }
  },

  setOrgLogo: (url) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { logoUrl: url });
    }
  },

  setOrgContractLegalText: (text) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { contractLegalText: text });
    }
  },

  addOrgContractFile: (file) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { contractFiles: arrayUnion(file) });
    }
  },

  removeOrgContractFile: (file) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { contractFiles: arrayRemove(file) });
    }
  },

  setOrgVenueDetails: (details) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), details);
    }
  },

  setOrgLeadSources: (sources) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { leadSources: sources });
    }
  },

  setLeadQuoteOptionalDates: (leadId, dates) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, quote_optional_dates: dates } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { quote_optional_dates: dates });
    }
  },

  addCatalogItem: (item) => {
    const { orgId } = get();
    const itemId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "catalog")).id
        : `cat${catalogCounter++}`;
    const newItem: CatalogItem = { ...item, item_id: itemId };
    set((state) => ({ catalog: [...state.catalog, newItem] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "catalog", itemId), stripUndefined({ ...newItem }));
    }
  },

  updateCatalogItem: (itemId, updates) => {
    const { orgId } = get();
    set((state) => ({
      catalog: state.catalog.map((c) => (c.item_id === itemId ? { ...c, ...updates } : c)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "catalog", itemId), stripUndefined({ ...updates }));
    }
  },

  deleteCatalogItem: (itemId) => {
    const { orgId } = get();
    set((state) => ({ catalog: state.catalog.filter((c) => c.item_id !== itemId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "catalog", itemId));
    }
  },

  addCatalogBundle: (bundle) => {
    const { orgId } = get();
    const bundleId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "catalogBundles")).id
        : `bun${catalogBundleCounter++}`;
    const newBundle: CatalogBundle = { ...bundle, bundle_id: bundleId };
    set((state) => ({ catalogBundles: [...state.catalogBundles, newBundle] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "catalogBundles", bundleId), stripUndefined({ ...newBundle }));
    }
  },

  updateCatalogBundle: (bundleId, updates) => {
    const { orgId } = get();
    set((state) => ({
      catalogBundles: state.catalogBundles.map((b) => (b.bundle_id === bundleId ? { ...b, ...updates } : b)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "catalogBundles", bundleId), stripUndefined({ ...updates }));
    }
  },

  deleteCatalogBundle: (bundleId) => {
    const { orgId } = get();
    set((state) => ({ catalogBundles: state.catalogBundles.filter((b) => b.bundle_id !== bundleId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "catalogBundles", bundleId));
    }
  },

  addPaymentTemplate: (template) => {
    const { orgId } = get();
    const templateId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "paymentTemplates")).id
        : `pt${paymentTemplateCounter++}`;
    const newTemplate: PaymentTemplate = { ...template, template_id: templateId };
    set((state) => ({ paymentTemplates: [...state.paymentTemplates, newTemplate] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "paymentTemplates", templateId), stripUndefined({ ...newTemplate }));
    }
  },

  updatePaymentTemplate: (templateId, updates) => {
    const { orgId } = get();
    set((state) => ({
      paymentTemplates: state.paymentTemplates.map((t) => (t.template_id === templateId ? { ...t, ...updates } : t)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "paymentTemplates", templateId), stripUndefined({ ...updates }));
    }
  },

  deletePaymentTemplate: (templateId) => {
    const { orgId } = get();
    set((state) => ({ paymentTemplates: state.paymentTemplates.filter((t) => t.template_id !== templateId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "paymentTemplates", templateId));
    }
  },

  addLead: (data) => {
    const { orgId, currentUserId } = get();
    const leadId =
      isFirebaseConfigured && orgId ? doc(collection(db!, "organizations", orgId, "leads")).id : `l${leadCounter++}`;

    const newLead: LeadEvent = {
      lead_id: leadId,
      event_type_id: data.event_type_id,
      contacts: data.contacts.map((c) => ({ ...c, contact_id: `c${contactCounter++}` })),
      custom_title: data.custom_title ?? null,
      email: data.email,
      lead_source: data.lead_source ?? "אחר",
      assigned_user_id: data.assigned_user_id ?? currentUserId,
      status: "potential",
      pipeline_stage: "initial_contact",
      event_date: data.event_date ?? null,
      event_start_time: data.event_start_time,
      event_end_time: data.event_end_time,
      event_season_preferred: data.event_season_preferred,
      estimated_guests: data.estimated_guests ?? 0,
      price_per_plate: data.price_per_plate ?? 0,
      milestones: [
        { key: "first_contact", label: "פנייה ראשונית בוצעה", done: true },
        { key: "meeting_scheduled", label: "פגישה נקבעה", done: false },
        { key: "site_visit_done", label: "סיור באולם בוצע", done: false },
        { key: "quote_sent", label: "הצעת מחיר נשלחה", done: false },
        { key: "deposit_paid", label: "מקדמה שולמה", done: false },
        { key: "contract_signed", label: "חוזה נחתם", done: false },
        { key: "menu_finalized", label: "תפריט סופי סוכם", done: false },
      ],
      documents: [],
      created_at: new Date().toISOString(),
      created_by_user_id: currentUserId,
      follow_up_at: null,
      first_inquiry_at: data.first_inquiry_at ?? new Date().toISOString(),
      promises: data.promises ?? "",
      status_changed_at: null,
      status_changed_by: null,
    };

    set((state) => ({ leads: [newLead, ...state.leads] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "leads", leadId), stripUndefined({ ...newLead }));
    }
    get().addSystemActivity(newLead.lead_id, "note", "ליד חדש נוצר במערכת.");
    return newLead;
  },

  updateLeadContacts: (leadId, contacts, customTitle) => {
    const { orgId } = get();
    const updates = { contacts, ...(customTitle !== undefined ? { custom_title: customTitle } : {}) };
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, ...updates } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), stripUndefined({ ...updates }));
    }
    get().addSystemActivity(leadId, "note", "פרטי אנשי הקשר עודכנו.");
  },

  updateLeadCart: (leadId, cart) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, cart } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { cart });
    }
  },

  addCartItems: (leadId, itemIds) => {
    const { orgId, catalog, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const existing = lead.cart ?? [];
    const already = new Set(existing.map((c) => c.item_id));
    const newLines: CartLineItem[] = itemIds
      .filter((id) => !already.has(id))
      .map((id) => {
        const item = catalog.find((c) => c.item_id === id);
        return {
          item_id: id,
          quantity: item?.unit === "per_guest" ? lead.estimated_guests : 1,
          vat_mode: "included" as const,
        };
      });
    if (newLines.length === 0) return;
    const cart = [...existing, ...newLines];
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, cart } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { cart });
    }
  },

  updateCartLine: (leadId, itemId, patch) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const cart = (lead.cart ?? []).map((c) =>
      c.item_id === itemId ? (stripUndefined({ ...c, ...patch }) as CartLineItem) : c
    );
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, cart } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { cart });
    }
  },

  removeCartItem: (leadId, itemId) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const cart = (lead.cart ?? []).filter((c) => c.item_id !== itemId);
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, cart } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { cart });
    }
  },

  setCartLocked: (leadId, locked) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, cart_locked: locked } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { cart_locked: locked });
    }
  },

  setOrgVatPercent: (percent) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { vatPercent: percent });
    }
  },

  setOrgFoodCostSettings: (monthlyOverhead, monthlyGuestForecast) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), {
        foodCostMonthlyOverhead: monthlyOverhead,
        foodCostMonthlyGuestForecast: monthlyGuestForecast,
      });
    }
  },

  setOrgRoleDefaultPermission: (role, area, level) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { [`roleDefaultPermissions.${role}.${area}`]: level }).catch(
        (err) => toast.error(`עדכון ברירת המחדל נכשל: ${err.message}`)
      );
    }
  },

  setOrgDepositSettings: (mode, value) => {
    const { orgId } = get();
    if (isFirebaseConfigured && orgId) {
      updateDoc(
        doc(db!, "organizations", orgId),
        mode === "percent" ? { depositMode: "percent", depositPercent: value } : { depositMode: "fixed", depositAmount: value }
      );
    }
  },

  updateLeadVenue: (leadId, venue) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, venue } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { venue });
    }
  },

  updateLeadSchedule: (leadId, schedule) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, ...schedule } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), stripUndefined({ ...schedule }));
    }
    get().addSystemActivity(leadId, "note", "תאריך/שעות האירוע עודכנו.");
    syncCalendarForLead(leadId);
  },

  updateLeadGuests: (leadId, guests) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, estimated_guests: guests } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { estimated_guests: guests });
    }
  },

  // מתקן טעות שיוך (למשל נציג בחר "בר מצווה" במקום "חינה") — משנה רק את סוג
  // האירוע; אנשי הקשר וכל שאר הנתונים נשארים כפי שהיו.
  updateLeadEventType: (leadId, eventTypeId) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, event_type_id: eventTypeId } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { event_type_id: eventTypeId });
    }
    get().addSystemActivity(leadId, "note", "סוג האירוע עודכן.");
  },

  setLeadDepositOverride: (leadId, override) => {
    const { orgId } = get();
    const updates = override
      ? { deposit_override_mode: override.mode, deposit_override_value: override.value }
      : { deposit_override_mode: null, deposit_override_value: null };
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, ...updates } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), updates);
    }
  },

  updateLeadPhoto: (leadId, photoUrl) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, photo_url: photoUrl } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { photo_url: photoUrl });
    }
  },

  updateLeadStage: (leadId, stage) => {
    const { orgId } = get();
    const status = stage === "closed_won" ? "closed" : undefined;
    set((state) => ({
      leads: state.leads.map((l) =>
        l.lead_id === leadId ? { ...l, pipeline_stage: stage, status: status ?? l.status } : l
      ),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(
        doc(db!, "organizations", orgId, "leads", leadId),
        stripUndefined({ pipeline_stage: stage, status })
      );
    }
  },

  updateLeadStatus: (leadId, status) => {
    const { orgId, currentUserId } = get();
    const changedAt = new Date().toISOString();
    set((state) => ({
      leads: state.leads.map((l) =>
        l.lead_id === leadId
          ? { ...l, status, status_changed_at: changedAt, status_changed_by: currentUserId }
          : l
      ),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), {
        status,
        status_changed_at: changedAt,
        status_changed_by: currentUserId,
      });
    }
    // סטטוס שיצא מ"לא רלוונטי" — מנקים את סיבת האובדן
    if (status !== "not_relevant") {
      const lead = get().leads.find((l) => l.lead_id === leadId);
      if (lead?.lost_reason) {
        set((state) => ({
          leads: state.leads.map((l) =>
            l.lead_id === leadId ? { ...l, lost_reason: null } : l
          ),
        }));
        if (isFirebaseConfigured && orgId) {
          updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { lost_reason: null });
        }
      }
    }
    const label =
      status === "closed" ? "סגור" : status === "not_relevant" ? "לא רלוונטי" : "פוטנציאלי";
    get().addSystemActivity(leadId, "status_change", `סטטוס ראשי שונה ל-${label}.`);
    syncCalendarForLead(leadId);
  },

  // מעבר לסטטוס "סגור" תמיד עובר דרך כאן — מאשר/מעדכן בבת-אחת את כל פרטי
  // האירוע הסופיים (תאריך, שעות, בוקר/ערב, מוזמנים, סגנון הגשה) יחד עם הסטטוס,
  // כדי שסגירה לא תיצור מצב-ביניים של אירוע "סגור" בלי פרטים סופיים.
  closeLeadEvent: (leadId, details) => {
    const { orgId, currentUserId } = get();
    const changedAt = new Date().toISOString();
    const updates = { ...details, status: "closed" as const, status_changed_at: changedAt, status_changed_by: currentUserId };
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, ...updates } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), updates);
    }
    get().addSystemActivity(leadId, "status_change", "האירוע נסגר ופרטי האירוע הסופיים אושרו.");
    syncCalendarForLead(leadId);
  },

  // חשיפה ל-UI כדי לתקן רטרואקטיבית לידים שנסגרו לפני שהסנכרון האוטומטי
  // ליומן נוסף — הכרטיס קורא לזה בכל פתיחה של Drawer.
  syncLeadCalendar: (leadId) => {
    syncCalendarForLead(leadId);
  },

  toggleMilestone: (leadId, key) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const nextMilestones = lead.milestones.map((m) =>
      m.key === key ? { ...m, done: !m.done } : m
    );
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, milestones: nextMilestones } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { milestones: nextMilestones });
    }
  },

  setFollowUp: (leadId, iso) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, follow_up_at: iso } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { follow_up_at: iso });
    }
    get().addSystemActivity(
      leadId,
      "note",
      iso ? `נקבע פולו-אפ הבא ל-${new Date(iso).toLocaleString("he-IL")}.` : "פולו-אפ בוטל."
    );
  },

  setPromises: (leadId, promises) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, promises } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { promises });
    }
  },

  setLeadPaymentSchedule: (leadId, steps) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, payment_schedule: steps } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { payment_schedule: steps });
    }
  },

  markPaymentStepPaid: (leadId, stepId, paid) => {
    const { orgId, currentUserId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead?.payment_schedule) return;
    const nextSchedule = lead.payment_schedule.map((s) =>
      s.step_id === stepId
        ? {
            ...s,
            is_paid: paid,
            paid_at: paid ? new Date().toISOString() : null,
            paid_by_user_id: paid ? currentUserId : null,
          }
        : s
    );
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, payment_schedule: nextSchedule } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { payment_schedule: nextSchedule });
    }
    const step = lead.payment_schedule.find((s) => s.step_id === stepId);
    if (step) {
      get().addSystemActivity(
        leadId,
        "note",
        paid
          ? `תשלום "${step.label}" (${formatCurrency(step.amount)}) סומן כשולם.`
          : `תשלום "${step.label}" סומן כלא-שולם.`
      );
    }
  },

  setFirstInquiry: (leadId, iso) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, first_inquiry_at: iso } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { first_inquiry_at: iso });
    }
  },

  setLostReason: (leadId, reason) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, lost_reason: reason } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { lost_reason: reason });
    }
    if (reason) {
      get().addSystemActivity(leadId, "status_change", `סיבת אובדן עודכנה: ${reason}.`);
    }
  },

  addSystemActivity: (leadId, type, content) => {
    addActivityInternal(get, set, leadId, type, content, undefined, true);
  },

  addActivity: (leadId, type, content, participantIds) => {
    addActivityInternal(get, set, leadId, type, content, participantIds, false);
  },

  // עריכה/מחיקה של תיעוד מותרות ל-admin בלבד (נאכף ב-firestore.rules).
  // הכתיבה אופטימיסטית, ולכן כישלון חייב לגלגל את המצב המקומי אחורה —
  // בלי זה המשתמש ראה "נמחק" והשינוי חזר ברענון הבא.
  updateActivity: (activityId, content) => {
    const { orgId, activity } = get();
    const previous = activity.find((a) => a.activity_id === activityId);
    set((state) => ({
      activity: state.activity.map((a) => (a.activity_id === activityId ? { ...a, content } : a)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "activity", activityId), { content }).catch(() => {
        if (previous) {
          set((state) => ({
            activity: state.activity.map((a) => (a.activity_id === activityId ? previous : a)),
          }));
        }
        toast.error("עריכת התיעוד נכשלה — רק מנהל יכול לשנות רשומות קיימות.");
      });
    }
  },

  deleteActivity: (activityId) => {
    const { orgId, activity } = get();
    const previous = activity.find((a) => a.activity_id === activityId);
    set((state) => ({ activity: state.activity.filter((a) => a.activity_id !== activityId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "activity", activityId)).catch(() => {
        if (previous) set((state) => ({ activity: [previous, ...state.activity] }));
        toast.error("מחיקת התיעוד נכשלה — רק מנהל יכול למחוק רשומות קיימות.");
      });
    }
  },

  addMeeting: (leadId, type, date, time, notes) => {
    const { orgId, leads, currentUserId } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const meetingId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "leads", leadId, "meetings")).id
        : `m${meetingCounter++}`;
    const newMeeting: MeetingEntry = {
      meeting_id: meetingId,
      type,
      date,
      time: time || null,
      // notes חייב לרדת לגמרי (לא undefined) — Firestore's updateDoc זורק
      // חריגה סינכרונית על ערך undefined בתוך מערך, מה שהפיל בשקט את כל
      // השמירה (כולל סנכרון היומן) בכל פעם שהערה נשארה ריקה.
      ...(notes ? { notes } : {}),
      status: "scheduled",
      created_at: new Date().toISOString(),
      created_by_user_id: currentUserId,
      confirmation_token: randomToken(),
      confirmation_status: "pending",
    };
    const nextMeetings = [...(lead.meetings ?? []), newMeeting];
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, meetings: nextMeetings } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { meetings: nextMeetings });
    }
    const dateLabel = date ? new Date(date).toLocaleDateString("he-IL") : "ללא תאריך";
    get().addSystemActivity(leadId, "meeting", `נקבעה ${MEETING_TYPE_LABELS[type]} · ${dateLabel}.`);
    syncMeetingCalendarEvent(leadId, newMeeting);
  },

  cancelMeeting: (leadId, meetingId) => {
    const { orgId, leads, currentUserId } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const cancelledAt = new Date().toISOString();
    const nextMeetings = (lead.meetings ?? []).map((m) =>
      m.meeting_id === meetingId
        ? { ...m, status: "cancelled" as const, cancelled_by_user_id: currentUserId, cancelled_at: cancelledAt }
        : m
    );
    const meeting = nextMeetings.find((m) => m.meeting_id === meetingId);
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, meetings: nextMeetings } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { meetings: nextMeetings });
    }
    if (meeting) {
      get().addSystemActivity(leadId, "meeting", `${MEETING_TYPE_LABELS[meeting.type]} בוטלה.`);
    }
  },

  rescheduleMeeting: (leadId, meetingId, date, time) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const nextMeetings = (lead.meetings ?? []).map((m) =>
      m.meeting_id === meetingId ? { ...m, date, time: time || null } : m
    );
    const meeting = nextMeetings.find((m) => m.meeting_id === meetingId);
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, meetings: nextMeetings } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { meetings: nextMeetings });
    }
    if (meeting) {
      const dateLabel = date ? new Date(date).toLocaleDateString("he-IL") : "ללא תאריך";
      get().addSystemActivity(leadId, "meeting", `${MEETING_TYPE_LABELS[meeting.type]} נקבעה למועד חדש · ${dateLabel}.`);
      syncMeetingCalendarEvent(leadId, meeting);
    }
  },

  deleteMeeting: (leadId, meetingId) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const nextMeetings = (lead.meetings ?? []).filter((m) => m.meeting_id !== meetingId);
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, meetings: nextMeetings } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { meetings: nextMeetings });
    }
    removeMeetingCalendarEvent(meetingId);
  },

  addTask: (task) => {
    const { orgId } = get();
    const taskId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "tasks")).id
        : `t${taskCounter++}`;

    const newTask: Task = {
      ...task,
      task_id: taskId,
      is_completed: false,
      created_at: new Date().toISOString(),
    };
    set((state) => ({ tasks: [newTask, ...state.tasks] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "tasks", taskId), stripUndefined({ ...newTask }));
    }
  },

  deleteTask: (taskId) => {
    const { orgId } = get();
    set((state) => ({ tasks: state.tasks.filter((t) => t.task_id !== taskId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "tasks", taskId));
    }
  },

  toggleTask: (taskId) => {
    const { orgId, tasks, currentUserId } = get();
    const task = tasks.find((t) => t.task_id === taskId);
    if (!task) return;
    const isCompleted = !task.is_completed;
    const completedAt = isCompleted ? new Date().toISOString() : null;
    const completedBy = isCompleted ? currentUserId : null;
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.task_id === taskId
          ? { ...t, is_completed: isCompleted, completed_at: completedAt, completed_by_user_id: completedBy }
          : t
      ),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "tasks", taskId), {
        is_completed: isCompleted,
        completed_at: completedAt,
        completed_by_user_id: completedBy,
      });
    }
  },

  updateTask: (taskId, updates) => {
    const { orgId } = get();
    const task = get().tasks.find((t) => t.task_id === taskId);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.task_id === taskId ? { ...t, ...updates } : t)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "tasks", taskId), stripUndefined({ ...updates }));
    }
    if (task?.lead_id && updates.due_date && updates.due_date !== task.due_date) {
      get().addSystemActivity(
        task.lead_id,
        "note",
        `תאריך היעד של המטלה "${updates.title ?? task.title}" עודכן ל-${new Date(
          updates.due_date
        ).toLocaleString("he-IL")}.`
      );
    }
  },

  checkDateCollision: (date, excludeLeadId) => {
    return get().calendarEvents.find(
      (e) =>
        e.lead_id !== excludeLeadId &&
        (e.event_type === "confirmed_event" || e.event_type === "option_hold") &&
        sameDay(e.start_time, date)
    );
  },

  addCalendarEvent: (leadId, eventType, startTime, endTime, force = false) => {
    const { orgId, currentUserId } = get();

    // syncCalendarForLead מתחזק רשומת confirmed_event יחידה לכל ליד (נגזרת
    // מהסטטוס/תאריך שלו). הוספה ידנית שנייה יוצרת כפילות שלא נוקתה ע"י הסנכרון
    // ולא נתפסה ע"י checkDateCollision (שמדלג על אירועים של אותו ליד) —
    // במקום ליצור עוד רשומה, מעדכנים את הקיימת.
    if (eventType === "confirmed_event") {
      const existing = get().calendarEvents.find(
        (e) => e.lead_id === leadId && e.event_type === "confirmed_event"
      );
      if (existing) {
        return get().updateCalendarEvent(existing.calendar_event_id, eventType, startTime, endTime, force);
      }
    }

    const isBlocking = eventType === "confirmed_event" || eventType === "option_hold";
    if (isBlocking && !force) {
      const conflict = get().checkDateCollision(startTime, leadId);
      if (conflict) {
        return { success: false, conflict };
      }
    }

    const calendarEventId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "calendarEvents")).id
        : `c${calendarEventCounter++}`;

    const newEvent: CalendarEvent = {
      calendar_event_id: calendarEventId,
      lead_id: leadId,
      event_type: eventType,
      start_time: startTime,
      end_time: endTime,
      created_by_user_id: currentUserId,
    };
    set((state) => ({ calendarEvents: [...state.calendarEvents, newEvent] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "calendarEvents", calendarEventId), { ...newEvent });
    }
    return { success: true };
  },

  updateCalendarEvent: (calendarEventId, eventType, startTime, endTime, force = false) => {
    const { orgId, calendarEvents } = get();
    const target = calendarEvents.find((e) => e.calendar_event_id === calendarEventId);
    if (!target) return { success: false };

    const isBlocking = eventType === "confirmed_event" || eventType === "option_hold";
    if (isBlocking && !force) {
      const conflict = calendarEvents.find(
        (e) =>
          e.calendar_event_id !== calendarEventId &&
          e.lead_id !== target.lead_id &&
          (e.event_type === "confirmed_event" || e.event_type === "option_hold") &&
          sameDay(e.start_time, startTime)
      );
      if (conflict) {
        return { success: false, conflict };
      }
    }

    const updatedEvent: CalendarEvent = { ...target, event_type: eventType, start_time: startTime, end_time: endTime };
    set((state) => ({
      calendarEvents: state.calendarEvents.map((e) => (e.calendar_event_id === calendarEventId ? updatedEvent : e)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "calendarEvents", calendarEventId), {
        event_type: eventType,
        start_time: startTime,
        end_time: endTime,
      });
    }
    return { success: true };
  },

  deleteCalendarEvent: (calendarEventId) => {
    const { orgId } = get();
    set((state) => ({
      calendarEvents: state.calendarEvents.filter((e) => e.calendar_event_id !== calendarEventId),
    }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "calendarEvents", calendarEventId));
    }
    completeLinkedTasks((t) => t.linked_calendar_event_id === calendarEventId);
  },

  reserveDate: (leadId, startTime, endTime, expiresAt, force = false) => {
    const { orgId, currentUserId, leads } = get();
    if (!force) {
      const conflict = get().checkDateCollision(startTime, leadId);
      if (conflict) return { success: false, conflict };
    }

    const calendarEventId =
      isFirebaseConfigured && orgId
        ? doc(collection(db!, "organizations", orgId, "calendarEvents")).id
        : `c${calendarEventCounter++}`;
    const newEvent: CalendarEvent = {
      calendar_event_id: calendarEventId,
      lead_id: leadId,
      event_type: "option_hold",
      start_time: startTime,
      end_time: endTime,
      created_by_user_id: currentUserId,
    };
    set((state) => ({ calendarEvents: [...state.calendarEvents, newEvent] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "calendarEvents", calendarEventId), { ...newEvent });
    }

    const dateLabel = new Date(startTime).toLocaleDateString("he-IL");
    const expiryLabel = new Date(expiresAt).toLocaleDateString("he-IL");
    get().addSystemActivity(leadId, "note", `תאריך ${dateLabel} שוריין ביומן האולם, בתוקף עד ${expiryLabel}.`);

    const lead = leads.find((l) => l.lead_id === leadId);
    get().addTask({
      lead_id: leadId,
      assigned_user_id: currentUserId,
      created_by_user_id: currentUserId,
      title: `מעקב שריון תאריך ${dateLabel}${lead ? ` — ${getEventTitle(lead)}` : ""}`,
      due_date: expiresAt,
      linked_calendar_event_id: calendarEventId,
    });

    return { success: true };
  },

  addDocument: (leadId, docInput) => {
    const { orgId, leads, currentUserId } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;

    const newDoc: DocumentRef = {
      ...docInput,
      doc_id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      created_at: new Date().toISOString(),
      created_by_user_id: currentUserId,
    };
    const nextDocuments = [newDoc, ...lead.documents];
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, documents: nextDocuments } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { documents: nextDocuments });
    }
    get().addSystemActivity(
      leadId,
      "note",
      `${docInput.type === "quote" ? "הצעת מחיר" : docInput.type === "contract" ? "חוזה" : "מסמך"} "${docInput.name}" נוצר ונשמר בכרטיס הזוג.`
    );
  },

  renameDocument: (leadId, docId, name) => {
    const { orgId, leads, currentUserId } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const target = lead.documents.find((d) => d.doc_id === docId);
    if (!target) return;
    const nextDocuments = lead.documents.map((d) =>
      d.doc_id === docId
        ? { ...d, name, updated_at: new Date().toISOString(), updated_by_user_id: currentUserId }
        : d
    );
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, documents: nextDocuments } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { documents: nextDocuments });
    }
    get().addSystemActivity(leadId, "note", `מסמך "${target.name}" עודכן לשם "${name}".`);
  },

  // נשמר בשקט (בלי רישום בתיעוד) — זהו פרט טכני של השיתוף, לא פעולה של המשתמש.
  setDocumentShortUrl: (leadId, docId, shortUrl) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const nextDocuments = lead.documents.map((d) =>
      d.doc_id === docId ? { ...d, short_url: shortUrl } : d
    );
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, documents: nextDocuments } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { documents: nextDocuments });
    }
  },

  // נכתב בשלמותו (לא merge) — הטופס מחזיק את כל האובייקט בזיכרון ושומר
  // אוטומטית, כך שכתיבה חלקית רק תפתח פתח למצבים לא עקביים.
  updateLeadPlanning: (leadId, planning) => {
    const { orgId, currentUserId } = get();
    const next: EventPlanning = {
      ...planning,
      updated_at: new Date().toISOString(),
      updated_by_user_id: currentUserId,
    };
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, planning: next } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { planning: next });
    }
  },

  deleteDocument: (leadId, docId) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const target = lead.documents.find((d) => d.doc_id === docId);
    if (!target) return;
    const nextDocuments = lead.documents.filter((d) => d.doc_id !== docId);
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, documents: nextDocuments } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { documents: nextDocuments });
    }
    get().addSystemActivity(leadId, "note", `מסמך "${target.name}" נמחק מכרטיס הזוג.`);
  },

  markDepositPaid: (leadId) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;
    const nextMilestones = lead.milestones.map((m) =>
      m.key === "deposit_paid" ? { ...m, done: true } : m
    );
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, milestones: nextMilestones } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { milestones: nextMilestones });
    }
    get().addSystemActivity(leadId, "status_change", 'סטטוס עודכן אוטומטית ל"מקדמה שולמה" לאחר יצירת קישור לתשלום.');
  },

  deleteLead: (leadId) => {
    const { orgId } = get();
    set((state) => ({
      leads: state.leads.filter((l) => l.lead_id !== leadId),
      activity: state.activity.filter((a) => a.lead_id !== leadId),
      tasks: state.tasks.filter((t) => t.lead_id !== leadId),
      calendarEvents: state.calendarEvents.filter((e) => e.lead_id !== leadId),
    }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "leads", leadId));
    }
  },
}));
