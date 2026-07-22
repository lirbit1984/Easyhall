// טיפוסי בסיס למערכת ניהול מכירות ולידים לאולם אירועים (Mini-CRM)
// מבוסס על מבנה הנתונים (Data Structure) שבמסמך האפיון

export type UserRole = "admin" | "sales_rep" | "office";

export interface User {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  avatar_color?: string; // צבע רקע לאווטאר (mock)
  created_at: string;
}

export type LeadStatus = "potential" | "closed" | "not_relevant";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  potential: "פוטנציאלי",
  closed: "סגור",
  not_relevant: "לא רלוונטי",
};

// סיבות אובדן ליד — נאסף כשליד מסומן "לא רלוונטי", לבניית זיכרון מוסדי
// (למה לידים נופלים). מבדל ייחודי: אף מתחרה לא חושף את זה כתובנה ניהולית.
export const LOST_REASONS = [
  "אין מענה / לא חזרו",
  "מחיר גבוה",
  "תאריך תפוס / לא מתאים",
  "בחרו אולם מתחרה",
  "מיקום",
  "בוטל (פרידה / טרגדיה)",
  "אחר",
] as const;

export type LostReason = (typeof LOST_REASONS)[number];

export type PipelineStage =
  | "initial_contact"
  | "meeting_set"
  | "meeting_done"
  | "quote_sent"
  | "contract_sent"
  | "closed_won";

export const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "initial_contact", label: "פנייה ראשונית" },
  { key: "meeting_set", label: "נקבעה פגישה" },
  { key: "meeting_done", label: "בוצעה פגישה" },
  { key: "quote_sent", label: "נשלחה הצעת מחיר / חוזה" },
  { key: "closed_won", label: "נסגר (Closed Won)" },
];

export interface Milestone {
  key: string;
  label: string;
  done: boolean;
}

export interface DocumentRef {
  doc_id: string;
  name: string;
  type: "quote" | "contract" | "other";
  url: string;
  created_at: string;
}

// מאגר הפריטים למכירה שהאדמין מגדיר (מחיר מנה, בר, עיצוב, צלם...).
// היחידה קובעת איך מחשבים: per_guest = מחיר × כמות מוזמנים, fixed = מחיר קבוע.
export type CatalogUnit = "per_guest" | "fixed";

export const CATALOG_UNIT_LABELS: Record<CatalogUnit, string> = {
  per_guest: "לאורח",
  fixed: "מחיר קבוע",
};

export interface CatalogItem {
  item_id: string;
  name: string;
  unit: CatalogUnit;
  price: number;
  active: boolean; // פריט לא-פעיל לא מוצע בעגלה חדשה אך נשמר בעגלות קיימות
  sort_order?: number;
}

// מאגר קבוע של תפקידי אנשי-קשר — האדמין בוחר מהמאגר הזה בעת הגדרת סוג
// אירוע חדש (checkboxes), לא ממציא תוויות חדשות.
export type EventContactRoleKey =
  | "bride"
  | "groom"
  | "bride_mother"
  | "bride_father"
  | "groom_mother"
  | "groom_father"
  | "event_producer"
  | "parent"
  | "celebrant"
  | "company_name"
  | "business_rep"
  | "production_company"
  | "guest";

export const EVENT_CONTACT_ROLE_LABELS: Record<EventContactRoleKey, string> = {
  bride: "כלה",
  groom: "חתן",
  bride_mother: "אמא כלה",
  bride_father: "אבא כלה",
  groom_mother: "אמא חתן",
  groom_father: "אבא חתן",
  event_producer: "מפיק אירוע",
  parent: "הורה",
  celebrant: "חוגג/ת",
  company_name: "שם החברה",
  business_rep: "נציג מטעם העסק",
  production_company: "חברת הפקה",
  guest: "איש קשר",
};

export interface EventContact {
  contact_id: string;
  role_key: EventContactRoleKey;
  name: string;
  phone?: string;
  email?: string;
  id_number?: string; // ת.ז / ח.פ (לחוזה)
  address?: string;
}

// סוג אירוע — אוסף org-scoped שהאדמין מנהל בהגדרות (כמו הקטלוג/פריסטים).
// role_keys קובע אילו תפקידים מוצעים בתפריט הבחירה לאיש-קשר עבור סוג זה.
export interface EventType {
  event_type_id: string;
  name: string;
  role_keys: EventContactRoleKey[];
  sort_order?: number;
  // ריק/undefined = סוג גלובלי (מנוהל ע"י admin, מוצג לכולם). מוגדר = סוג
  // אישי שנוצר ע"י המשתמש הזה בטופס "ליד חדש" — מוצג רק אצלו.
  owner_user_id?: string | null;
  // צבע התגית שמוצגת על כרטיס האירוע (קנבן) — admin קובע לסוגים גלובליים.
  color?: string;
}

// שורת פריט בעגלת התשלומים של האירוע — quantity תמיד = estimated_guests
// עבור פריטי per_guest (לא ניתן לעריכה ידנית), וברירת מחדל 1 (ניתן לעריכה)
// עבור פריטי fixed.
export interface CartLineItem {
  item_id: string;
  quantity: number;
}

export interface LeadEvent {
  lead_id: string;
  event_type_id: string;
  contacts: EventContact[];
  // דריסה ידנית של כותרת הכרטיס; כשריק — הכותרת מחושבת אוטומטית מ-contacts.
  custom_title?: string | null;
  venue?: string;
  cart?: CartLineItem[];
  email?: string;
  lead_source: string;
  assigned_user_id: string;
  status: LeadStatus;
  pipeline_stage: PipelineStage;
  event_date: string | null; // ISO date
  event_start_time?: string; // "HH:mm" - שעת התחלת האירוע הסופית
  event_end_time?: string; // "HH:mm" - שעת סיום האירוע הסופית
  event_season_preferred?: string;
  estimated_guests: number;
  price_per_plate: number;
  milestones: Milestone[];
  documents: DocumentRef[];
  created_at: string;
  created_by_user_id: string;
  follow_up_at?: string | null; // ISO datetime - תאריך פולו-אפ הבא
  first_inquiry_at?: string | null; // ISO date - מתי התעניינו לראשונה (לא מתי נוצר הכרטיס)
  promises?: string; // הבטחות והערות לגבי הזוג - שדה נבדל מהפיד
  status_changed_at?: string | null; // ISO datetime - מתי הסטטוס עודכן לאחרונה
  status_changed_by?: string | null; // user_id של מי שעדכן את הסטטוס לאחרונה
  lost_reason?: string | null; // סיבת אובדן — נאסף כשהסטטוס "לא רלוונטי"
}

export type ActivityType =
  | "incoming_call"
  | "outgoing_call"
  | "whatsapp"
  | "meeting"
  | "note"
  | "status_change";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  incoming_call: "שיחה נכנסת",
  outgoing_call: "שיחה יוצאת",
  whatsapp: "וואטסאפ",
  meeting: "פגישה",
  note: "הערה",
  status_change: "שינוי סטטוס",
};

export interface ActivityFeedItem {
  activity_id: string;
  lead_id: string;
  user_id: string; // Audit Stamp
  activity_type: ActivityType;
  content: string;
  created_at: string;
  participant_ids?: string[]; // משתתפים נוספים בתיעוד (עובדים מהצוות)
}

export interface Task {
  task_id: string;
  lead_id?: string | null;
  assigned_user_id?: string | null; // ריק = ללא שיוך לאיש צוות
  created_by_user_id: string;
  title: string;
  due_date: string; // ISO datetime
  is_completed: boolean;
  completed_at?: string | null;
  completed_by_user_id?: string | null;
  created_at: string; // ISO datetime
}

/** פריסט מהיר לכותרת מטלה (למשל "לחזור ל...") — משותף לכל הצוות. */
export interface TaskPreset {
  preset_id: string;
  title: string;
  created_by_user_id: string;
}

export type CalendarEventType = "sales_meeting" | "option_hold" | "confirmed_event";

export const CALENDAR_EVENT_COLORS: Record<CalendarEventType, string> = {
  sales_meeting: "#3b82f6", // כחול = פגישת מכירה/סיור
  confirmed_event: "#22c55e", // ירוק = אירוע סגור
  option_hold: "#eab308", // צהוב = תאריך משוריין / אופציה
};

export const CALENDAR_EVENT_LABELS: Record<CalendarEventType, string> = {
  sales_meeting: "פגישת מכירה / סיור",
  option_hold: "תאריך משוריין / אופציה",
  confirmed_event: "אירוע סגור",
};

export interface CalendarEvent {
  calendar_event_id: string;
  lead_id: string;
  event_type: CalendarEventType;
  start_time: string; // ISO datetime
  end_time: string; // ISO datetime
  created_by_user_id: string;
}
