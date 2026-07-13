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

export interface LeadEvent {
  lead_id: string;
  partner_1_name: string;
  partner_2_name: string;
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
}

export interface Task {
  task_id: string;
  lead_id?: string | null;
  assigned_user_id: string;
  created_by_user_id: string;
  title: string;
  due_date: string; // ISO datetime
  is_completed: boolean;
  completed_at?: string | null;
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
