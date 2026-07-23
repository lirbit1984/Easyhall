import { create } from "zustand";
import { collection, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
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
  EventType,
  CartLineItem,
  CatalogItem,
  TaskPreset,
  MeetingEntry,
  MeetingType,
  MenuServingStyle,
} from "@/lib/types";
import { MEETING_TYPE_LABELS } from "@/lib/types";
import { CURRENT_USER } from "@/lib/mock-data";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";

let leadCounter = MOCK_LEADS.length + 1;
let activityCounter = MOCK_ACTIVITY.length + 1;
let taskCounter = MOCK_TASKS.length + 1;
let calendarEventCounter = MOCK_CALENDAR_EVENTS.length + 1;
let documentCounter = 1;
let catalogCounter = MOCK_CATALOG.length + 1;
let taskPresetCounter = MOCK_TASK_PRESETS.length + 1;
let eventTypeCounter = MOCK_EVENT_TYPES.length + 1;
let meetingCounter = 1;

function randomToken(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

const EVENT_TYPE_COLOR_PALETTE = [
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

  const others = state.calendarEvents.filter(
    (e) => !(e.lead_id === leadId && e.event_type === "confirmed_event")
  );

  if (lead.status !== "closed" || !lead.event_date) {
    useLeadsStore.setState({ calendarEvents: others });
    return;
  }

  const startTime = combineDateAndTime(lead.event_date, lead.event_start_time);
  const endTime = combineDateAndTime(lead.event_date, lead.event_end_time ?? lead.event_start_time);
  const existing = state.calendarEvents.find(
    (e) => e.lead_id === leadId && e.event_type === "confirmed_event"
  );
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
  const others = state.calendarEvents.filter((e) => e.meeting_id !== meeting.meeting_id);

  if (!meeting.date) {
    useLeadsStore.setState({ calendarEvents: others });
    return;
  }

  const startTime = combineDateAndTime(meeting.date, meeting.time ?? "09:00");
  const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
  const existing = state.calendarEvents.find((e) => e.meeting_id === meeting.meeting_id);
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
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
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
  taskPresets: TaskPreset[];
  eventTypes: EventType[];

  // PIN-ים למחיקת כרטיס אירוע: deletePin לאישור המחיקה עצמה, deleteUnlockPin
  // לשחרור נעילה זמנית אחרי 3 ניסיונות כושלים. נקבעים ע"י admin בהגדרות.
  deletePin: string;
  deleteUnlockPin: string;
  setDeletePin: (pin: string) => void;
  setDeleteUnlockPin: (pin: string) => void;

  hydrateLeads: (leads: LeadEvent[]) => void;
  hydrateActivity: (activity: ActivityFeedItem[]) => void;
  hydrateTasks: (tasks: Task[]) => void;
  hydrateCalendarEvents: (events: CalendarEvent[]) => void;
  hydrateCatalog: (catalog: CatalogItem[]) => void;
  hydrateTaskPresets: (presets: TaskPreset[]) => void;
  hydrateEventTypes: (types: EventType[]) => void;
  hydrateSecurityPins: (pins: { deletePin?: string; deleteUnlockPin?: string }) => void;

  addCatalogItem: (item: Omit<CatalogItem, "item_id">) => void;
  updateCatalogItem: (itemId: string, updates: Partial<Omit<CatalogItem, "item_id">>) => void;
  deleteCatalogItem: (itemId: string) => void;

  addTaskPreset: (title: string) => void;
  deleteTaskPreset: (presetId: string) => void;

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
  updateLeadVenue: (leadId: string, venue: string) => void;
  updateLeadGuests: (leadId: string, guests: number) => void;
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
  setFirstInquiry: (leadId: string, iso: string | null) => void;
  setLostReason: (leadId: string, reason: string | null) => void;
  addActivity: (
    leadId: string,
    type: ActivityType,
    content: string,
    participantIds?: string[]
  ) => void;
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
  addDocument: (leadId: string, doc: Omit<DocumentRef, "doc_id" | "created_at">) => void;
  markDepositPaid: (leadId: string) => void;

  deleteLead: (leadId: string) => void;
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
  orgId: null,
  currentUserId: CURRENT_USER.user_id,
  currentUserName: CURRENT_USER.full_name,
  setSession: (orgId, userId, userName) =>
    set({ orgId, currentUserId: userId, currentUserName: userName }),

  leads: MOCK_LEADS,
  activity: MOCK_ACTIVITY,
  tasks: MOCK_TASKS,
  calendarEvents: MOCK_CALENDAR_EVENTS,
  catalog: MOCK_CATALOG,
  taskPresets: MOCK_TASK_PRESETS,
  eventTypes: MOCK_EVENT_TYPES,
  deletePin: "0000",
  deleteUnlockPin: "9999",

  setDeletePin: (pin) => {
    const { orgId } = get();
    set({ deletePin: pin });
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { deletePin: pin });
    }
  },
  setDeleteUnlockPin: (pin) => {
    const { orgId } = get();
    set({ deleteUnlockPin: pin });
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId), { deleteUnlockPin: pin });
    }
  },
  hydrateSecurityPins: ({ deletePin, deleteUnlockPin }) =>
    set((state) => ({
      deletePin: deletePin ?? state.deletePin,
      deleteUnlockPin: deleteUnlockPin ?? state.deleteUnlockPin,
    })),

  hydrateLeads: (leads) => set({ leads }),
  hydrateActivity: (activity) => set({ activity }),
  hydrateTasks: (tasks) => set({ tasks }),
  hydrateCalendarEvents: (calendarEvents) => set({ calendarEvents }),
  hydrateCatalog: (catalog) =>
    set({ catalog: [...catalog].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }),
  hydrateTaskPresets: (taskPresets) => set({ taskPresets }),
  hydrateEventTypes: (eventTypes) =>
    set({ eventTypes: [...eventTypes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }),

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
      setDoc(doc(db!, "organizations", orgId, "eventTypes", typeId), stripUndefined({ ...newType }));
    }
  },

  updateEventType: (typeId, updates) => {
    const { orgId } = get();
    set((state) => ({
      eventTypes: state.eventTypes.map((t) => (t.event_type_id === typeId ? { ...t, ...updates } : t)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "eventTypes", typeId), stripUndefined({ ...updates }));
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

  deleteTaskPreset: (presetId) => {
    const { orgId } = get();
    set((state) => ({ taskPresets: state.taskPresets.filter((p) => p.preset_id !== presetId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "taskPresets", presetId));
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
    get().addActivity(newLead.lead_id, "note", "ליד חדש נוצר במערכת.");
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
    get().addActivity(leadId, "note", "פרטי אנשי הקשר עודכנו.");
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
    get().addActivity(leadId, "note", "תאריך/שעות האירוע עודכנו.");
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
    get().addActivity(leadId, "status_change", `סטטוס ראשי שונה ל-${label}.`);
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
    get().addActivity(leadId, "status_change", "האירוע נסגר ופרטי האירוע הסופיים אושרו.");
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
    get().addActivity(
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
      get().addActivity(leadId, "status_change", `סיבת אובדן עודכנה: ${reason}.`);
    }
  },

  addActivity: (leadId, type, content, participantIds) => {
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
      ...(participantIds && participantIds.length > 0
        ? { participant_ids: participantIds }
        : {}),
    };
    set((state) => ({ activity: [newActivity, ...state.activity] }));
    if (isFirebaseConfigured && orgId) {
      setDoc(doc(db!, "organizations", orgId, "activity", activityId), stripUndefined({ ...newActivity }));
    }
  },

  updateActivity: (activityId, content) => {
    const { orgId } = get();
    set((state) => ({
      activity: state.activity.map((a) => (a.activity_id === activityId ? { ...a, content } : a)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "activity", activityId), { content });
    }
  },

  deleteActivity: (activityId) => {
    const { orgId } = get();
    set((state) => ({ activity: state.activity.filter((a) => a.activity_id !== activityId) }));
    if (isFirebaseConfigured && orgId) {
      deleteDoc(doc(db!, "organizations", orgId, "activity", activityId));
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
      notes: notes || undefined,
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
    get().addActivity(leadId, "meeting", `נקבעה ${MEETING_TYPE_LABELS[type]} · ${dateLabel}.`);
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
      get().addActivity(leadId, "meeting", `${MEETING_TYPE_LABELS[meeting.type]} בוטלה.`);
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
      get().addActivity(
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

  addDocument: (leadId, docInput) => {
    const { orgId, leads } = get();
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead) return;

    const newDoc: DocumentRef = {
      ...docInput,
      doc_id: `d${documentCounter++}`,
      created_at: new Date().toISOString(),
    };
    const nextDocuments = [newDoc, ...lead.documents];
    set((state) => ({
      leads: state.leads.map((l) => (l.lead_id === leadId ? { ...l, documents: nextDocuments } : l)),
    }));
    if (isFirebaseConfigured && orgId) {
      updateDoc(doc(db!, "organizations", orgId, "leads", leadId), { documents: nextDocuments });
    }
    get().addActivity(
      leadId,
      "note",
      `${docInput.type === "quote" ? "הצעת מחיר" : docInput.type === "contract" ? "חוזה" : "מסמך"} "${docInput.name}" נוצר ונשמר בכרטיס הזוג.`
    );
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
    get().addActivity(leadId, "status_change", 'סטטוס עודכן אוטומטית ל"מקדמה שולמה" לאחר יצירת קישור לתשלום.');
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
