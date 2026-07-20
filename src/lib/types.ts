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

export type PartnerGender = "bride" | "groom" | "unspecified";

export const PARTNER_GENDER_LABELS: Record<PartnerGender, string> = {
  bride: "כלה",
  groom: "חתן",
  unspecified: "לא צוין",
};

export interface LeadEvent {
  lead_id: string;
  partner_1_name: string;
  partner_2_name: string;
  // אופציונלי — קובע רק את סדר התצוגה (הכלה תמיד ראשונה כשמצוין חתן+כלה),
  // לא משפיע על שום דבר אחר. בזוגות חד-מיניים או ללא ציון נשמר סדר ההזנה.
  partner_1_gender?: PartnerGender;
  partner_2_gender?: PartnerGender;
  phone_primary: string;
  phone_secondary?: string;
  email?: string;
  lead_source: string;
  assigned_user_id: string;
  status: LeadStatus;
  pipeline_stage: PipelineStage;
  event_date: string | null; // ISO date
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
