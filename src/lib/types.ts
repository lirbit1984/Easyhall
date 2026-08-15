// טיפוסי בסיס למערכת ניהול מכירות ולידים לאולם אירועים (Mini-CRM)
// מבוסס על מבנה הנתונים (Data Structure) שבמסמך האפיון

export type UserRole = "admin" | "sales_rep" | "office" | "event_manager";

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
  created_by_user_id?: string;
  updated_at?: string | null;
  updated_by_user_id?: string | null;
  /** קישור קצר (/f/{code}) שנוצר בשיתוף הראשון ומשמש מכאן והלאה בכל שיתוף. */
  short_url?: string;
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

/**
 * חבילה — קיבוץ של כמה פריטי קטלוג (למשל "חבילת פרימיום": DJ + עיצוב +
 * אטרקציות) שנוספים לעגלה כיחידה אחת בלחיצה אחת, במקום פריט-פריט.
 */
export interface CatalogBundle {
  bundle_id: string;
  name: string;
  item_ids: string[];
  active: boolean;
}

// כלל תזמון לשלב תשלום: "on_signing" = בחתימת החוזה (ללא timing_days),
// "before_event"/"after_event" = timing_days ימים לפני/אחרי תאריך האירוע.
export type PaymentTimingType = "on_signing" | "before_event" | "after_event";

export interface PaymentTemplateStep {
  step_id: string;
  label: string;
  amount_type: "percent" | "fixed";
  amount_value: number;
  timing_type: PaymentTimingType;
  timing_days?: number; // רלוונטי רק ל-before_event/after_event
}

// תבנית לוח תשלומים ברמת הארגון — נבחרת ונערכת בהפקת חוזה; עריכת התבנית
// אחרי היישום על חוזה קיים לא משפיעה על שלבי התשלום שכבר נוצרו (lead.payment_schedule).
export interface PaymentTemplate {
  template_id: string;
  name: string;
  steps: PaymentTemplateStep[];
  active: boolean;
}

// שלב תשלום קונקרטי על ליד — נוצר מתבנית (או ידנית) בזמן הפקת חוזה, עם
// סכום ותאריך יעד מחושבים בפועל. עצמאי מהתבנית המקורית מרגע היצירה.
export interface LeadPaymentStep {
  step_id: string;
  label: string;
  amount: number; // ש"ח, מחושב סופית (לא אחוז)
  due_date: string; // ISO date
  is_paid: boolean;
  paid_at?: string | null;
  paid_by_user_id?: string | null;
  linked_task_id?: string | null; // Task שנוצר עם הגעת/חלוף מועד היעד — נסגר אוטומטית כשמסמנים "שולם"
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

// תווית לתצוגה עבור role_key — תפקיד מהמאגר הקבוע מתורגם דרך
// EVENT_CONTACT_ROLE_LABELS, תווית חופשית (custom) מוצגת כמות שהיא.
export function getRoleLabel(roleKey: EventContactRole): string {
  return EVENT_CONTACT_ROLE_LABELS[roleKey as EventContactRoleKey] ?? roleKey;
}

// תפקיד איש-קשר: אחד מהמאגר הקבוע, או תווית חופשית שהאדמין הגדיר לסוג
// האירוע (custom role) — ר' getRoleLabel לתרגום לתצוגה.
export type EventContactRole = EventContactRoleKey | (string & {});

export interface EventContact {
  contact_id: string;
  role_key: EventContactRole;
  name: string;
  phone?: string;
  email?: string;
  id_number?: string; // ת.ז / ח.פ (לחוזה)
  address?: string;
}

// מפתחות אייקון וקטורי לסוג אירוע — שם קומפוננטת lucide-react תואמת. הרשימה
// נבחרה לכסות אירועים נפוצים (חתונה/בר-בת מצווה/ברית/חינה/אירוע חברה וכו').
// מיפוי המפתח לקומפוננטה בפועל נמצא ב-src/components/event-type-icon.tsx.
export const EVENT_TYPE_ICON_KEYS = [
  "heart",
  "heart-handshake",
  "gem",
  "crown",
  "users",
  "user-round",
  "baby",
  "cake",
  "party-popper",
  "sparkles",
  "flower",
  "star",
  "graduation-cap",
  "building",
  "briefcase",
  "handshake",
  "gift",
  "music",
  "wine",
  "utensils",
  "camera",
  "ribbon",
  "calendar-heart",
  "diamond",
  "tent",
  "baby-carriage",
] as const;
export type EventTypeIconKey = (typeof EVENT_TYPE_ICON_KEYS)[number];

// סוג אירוע — אוסף org-scoped שהאדמין מנהל בהגדרות (כמו הקטלוג/פריסטים).
// role_keys קובע אילו תפקידים מוצעים בתפריט הבחירה לאיש-קשר עבור סוג זה.
export interface EventType {
  event_type_id: string;
  name: string;
  role_keys: EventContactRole[];
  sort_order?: number;
  // ריק/undefined = סוג גלובלי (מנוהל ע"י admin, מוצג לכולם). מוגדר = סוג
  // אישי שנוצר ע"י המשתמש הזה בטופס "ליד חדש" — מוצג רק אצלו.
  owner_user_id?: string | null;
  // צבע התגית שמוצגת על כרטיס האירוע (קנבן) — admin קובע לסוגים גלובליים.
  color?: string;
  // אייקון וקטורי מייצג — מוצג קטן על כרטיס הליד וגדול בדרוור כשאין תמונה.
  icon?: EventTypeIconKey;
}

// שורת פריט בעגלת התשלומים של האירוע — quantity ברירת מחדל: estimated_guests
// עבור פריטי per_guest, 1 עבור פריטי fixed; שניהם ניתנים לעריכה חופשית לאחר
// ההוספה. price_override דורס את מחיר הקטלוג לאירוע הזה בלבד (undefined =
// משתמשים במחיר הקטלוג). vat_mode קובע אם price/price_override הוא לפני מעמ
// או כולל מעמ (ברירת מחדל plus_vat, כמו ההתנהגות הישנה).
export interface CartLineItem {
  item_id: string;
  quantity: number;
  price_override?: number;
  vat_mode?: "plus_vat" | "included";
}

// תאריך מועמד אחד בהצעת מחיר עם כמה תאריכים אפשריים — כל תאריך יכול לדרוס
// את מחיר היחידה של כל פריט בעגלה בנפרד (price_overrides: item_id -> מחיר).
// פריט בלי override בתאריך נתון משתמש במחיר הרגיל של השורה בעגלה.
export interface QuoteOptionalDate {
  date_id: string;
  date: string; // ISO date
  price_overrides?: Record<string, number>;
}

// פריסט טקסט הבטחות/הערות לפי סוג אירוע (למשל "ברית") — האדמין מגדיר
// בהגדרות, ונציג בוחר בהצעת מחיר כדי למלא אוטומטית ניסוח קבוע.
export interface PromisePreset {
  preset_id: string;
  event_type_name?: string; // legacy — פריסטים ישנים משויכים לסוג אחד; event_type_names הוא הפורמט הנוכחי
  event_type_names: string[];
  text: string;
}

// תיקייה במאגר הקבצים הארגוני — parent_folder_id מאפשר קינון (תיקייה בתוך
// תיקייה), null/undefined = תיקיית שורש.
export interface OrgFileFolder {
  folder_id: string;
  name: string;
  parent_folder_id?: string | null;
  created_at: string;
}

// קובץ במאגר הקבצים הארגוני הכללי (לא משויך לליד ספציפי) — תעודת כשרות,
// ביטוח, תמונות וכו'. מנוהל ע"י admin בהגדרות; תיוג בטקסט חופשי.
// folder_id null/undefined = הקובץ נמצא בתיקיית השורש.
export interface OrgFile {
  file_id: string;
  name: string;
  url: string;
  tag?: string;
  folder_id?: string | null;
  uploaded_at: string;
  uploaded_by_user_id?: string;
}

// סגנון הגשה — נבחר רק בעת סגירת האירוע (לא לפני), כחלק מאישור פרטי האירוע
// הסופיים. רשימה קבועה בקוד לעת עתה (לא מנוהלת ע"י admin).
export type MenuServingStyle = "personal" | "buffet" | "table_centerpieces" | "plated_fork";

export const MENU_SERVING_STYLE_LABELS: Record<MenuServingStyle, string> = {
  personal: "הגשה אישית",
  buffet: "בופה",
  table_centerpieces: "מרכזי שולחן",
  plated_fork: "צלחת מזלג",
};

export const EVENT_DAY_PART_LABELS: Record<"morning" | "evening", string> = {
  evening: "אירוע ערב",
  morning: "אירוע בוקר",
};

// 6 קטגוריות קבועות של מאגר המנות (מטבח האולם) — נפרד לגמרי ממאגר הפריטים
// לעגלת התשלומים (CatalogItem): המנות תיאוריות בלבד, בלי מחיר.
export const MENU_CATEGORIES = [
  "קבלת פנים",
  "סלטים ופלטות",
  "מנת ביניים",
  "מנה עיקרית",
  "קינוחים",
  "אפטר פארטי",
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

// כמות ברירת מחדל של מנות שאפשר לבחור בכל קטגוריה, כשלא הוגדר במפורש
// ב-orgDoc.menuCategoryLimits. admin יכול לחרוג מהמכסה בכרטיס האירוע.
export const DEFAULT_MENU_CATEGORY_LIMIT = 3;

// מנה במאגר מנות האולם — מנוהלת ע"י admin בהגדרות, נבחרת בטאב "תפריט" של כרטיס האירוע.
export interface MenuDish {
  dish_id: string;
  category: MenuCategory;
  name: string;
  sort_order?: number;
  // תיאור שיווקי קצר, מנוסח ע"י AI (או ידנית) בעת ההוספה — מוצג בהצעת
  // התפריט המופקת לזוג. אופציונלי; מנה בלי תיאור מוצגת עם השם בלבד.
  description?: string;
  // undefined/true = פעילה ומוצעת לבחירה חדשה. false = "נמחקה" מהמאגר —
  // מוסרת מרשימת ההוספה אבל נשארת ברשומה (ובכל אירוע שכבר בחר בה) כדי
  // שלא תישאר "תקועה" בבחירה בלי אפשרות להסיר אותה.
  active?: boolean;
}

export interface LeadEvent {
  lead_id: string;
  event_type_id: string;
  contacts: EventContact[];
  // דריסה ידנית של כותרת הכרטיס; כשריק — הכותרת מחושבת אוטומטית מ-contacts.
  custom_title?: string | null;
  venue?: string;
  photo_url?: string; // תמונת האירוע/הזוג המוצגת בהדר כרטיס הליד
  cart?: CartLineItem[];
  // ננעלת מעריכה אחרי שהוקלד התוכן הסופי, כדי שלא תישאר "פתוחה" תמידית
  // בטאב התשלומים; לחיצה על "ערוך עגלה" פותחת אותה מחדש להוספות.
  cart_locked?: boolean;
  /** טופס תיאום הציפיות — נוצר רק אחרי סגירת האירוע. ר' EventPlanning. */
  planning?: EventPlanning;
  email?: string;
  lead_source: string;
  assigned_user_id: string;
  status: LeadStatus;
  pipeline_stage: PipelineStage;
  event_date: string | null; // ISO date
  event_start_time?: string; // "HH:mm" - שעת התחלת האירוע הסופית
  event_end_time?: string; // "HH:mm" - שעת סיום האירוע הסופית
  event_season_preferred?: string;
  event_day_part?: "morning" | "evening" | null; // אירוע ערב/בוקר — נקבע סופית בסגירת האירוע
  serving_style?: MenuServingStyle | null; // סגנון הגשה — ניתן לבחירה רק בעת סגירת האירוע
  // חריגה למקדמה של האירוע הספציפי הזה בלבד — נקבעת רק ע"י admin בעגלת
  // התשלומים (לא משנה את ברירת המחדל הארגונית). undefined/null = משתמשים
  // בברירת המחדל הארגונית (orgDoc.depositMode/depositPercent/depositAmount).
  deposit_override_mode?: "percent" | "fixed" | null;
  deposit_override_value?: number | null;
  // תאריכים מועמדים להצעת מחיר אחת (הזוג עדיין מתלבט בין כמה תאריכים).
  quote_optional_dates?: QuoteOptionalDate[];
  // בחירת מנות מהמאגר לפי קטגוריה — dish_id-ים. כפוף למכסת orgDoc.menuCategoryLimits
  // אלא אם admin חורג ממנה בכוונה.
  menu_selection?: Partial<Record<MenuCategory, string[]>>;
  // הערה חופשית לכל מנה נבחרת (מפתח = dish_id) — "יותר מבושל", "מרכז שולחן"
  // וכו', מוצגת גם בהצעת התפריט המופקת. מוצגת/נערכת בחלונית סיכום הבחירה.
  menu_selection_notes?: Record<string, string>;
  // ננעל לאחר "שמירת התפריט" כדי שהטאב יציג רק את הבחירות (כמו cart_locked);
  // "עריכה" משחררת בחזרה לבחירה מלאה.
  menu_locked?: boolean;
  estimated_guests: number;
  price_per_plate: number;
  milestones: Milestone[];
  documents: DocumentRef[];
  created_at: string;
  created_by_user_id: string;
  follow_up_at?: string | null; // ISO datetime - תאריך פולו-אפ הבא
  first_inquiry_at?: string | null; // ISO date - מתי התעניינו לראשונה (לא מתי נוצר הכרטיס)
  promises?: string; // הבטחות והערות לגבי הזוג - שדה נבדל מהפיד
  meetings?: MeetingEntry[]; // מעקב פגישות עם הזוג (פגישה ראשונה/נוספת/שלישית/טעימות)
  status_changed_at?: string | null; // ISO datetime - מתי הסטטוס עודכן לאחרונה
  status_changed_by?: string | null; // user_id של מי שעדכן את הסטטוס לאחרונה
  lost_reason?: string | null; // סיבת אובדן — נאסף כשהסטטוס "לא רלוונטי"
  // לוח תשלומים קונקרטי — נוצר/נערך בזמן הפקת חוזה מתוך תבנית ארגונית (או
  // ידנית), null/undefined כל עוד לא הופק חוזה עם לוח תשלומים.
  payment_schedule?: LeadPaymentStep[] | null;
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
  /** נוצר אוטומטית ע"י המערכת (שליחה, עדכון פרטים, שינוי סטטוס) ולא הוקלד ע"י נציג. */
  is_system?: boolean;
}

/**
 * הניסוחים שהמערכת מייצרת. משמשים לסיווג רשומות שנשמרו לפני שהיה שדה
 * is_system — הן חסרות דגל, ובלי זיהוי לפי תוכן הן נראות כתיעוד ידני.
 * רשומות חדשות נושאות את הדגל, ולכן הרשימה הזו רלוונטית רק להיסטוריה.
 */
const SYSTEM_CONTENT_PATTERNS: RegExp[] = [
  /^ליד חדש נוצר במערכת\./,
  /^פרטי אנשי הקשר עודכנו\./,
  /^תאריך\/שעות האירוע עודכנו\./,
  /^נשלח מסמך ".*" ב/,
  /^נשלחה (הצעת מחיר|חוזה) ב/,
  /^נשלחה הודעת WhatsApp ל/,
  /^בוצעה שיחה יוצאת ל/,
  /^(הצעת מחיר|חוזה|מסמך) ".*" נוצר ונשמר בכרטיס הזוג\./,
  /^מסמך ".*" (עודכן לשם|נמחק מכרטיס הזוג)/,
  /^נקבעה .* · /,
  /^נקבע פולו-אפ הבא ל-/,
  /^פולו-אפ בוטל\./,
  /^תאריך היעד של המטלה ".*" עודכן ל-/,
];

/**
 * רשומות ישנות נשמרו לפני שהיה שדה is_system. שינויי סטטוס תמיד היו אוטומטיים,
 * ומעבר לזה מזוהות לפי הניסוח הקבוע שהמערכת מייצרת — כך שתיעוד היסטורי נוחת
 * באותו טאב כמו רשומות חדשות מאותו סוג.
 */
export function isSystemActivity(a: Pick<ActivityFeedItem, "is_system" | "activity_type" | "content">): boolean {
  if (a.is_system !== undefined) return a.is_system;
  if (a.activity_type === "status_change") return true;
  // ביטול פגישה נרשם כ"<סוג הפגישה> בוטלה." — נבדק מול הסוגים המוכרים ולא
  // בתבנית כללית, כדי לא לבלוע הערה שנציג כתב במקרה באותו ניסוח.
  if (Object.values(MEETING_TYPE_LABELS).some((label) => a.content === `${label} בוטלה.`)) return true;
  return SYSTEM_CONTENT_PATTERNS.some((re) => re.test(a.content));
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
  // מטלת מעקב שנוצרה אוטומטית עם שריון תאריך (option_hold) — מאפשר לסגור
  // אותה לבד כשהשריון מוסר או כשסטטוס הליד משתנה.
  linked_calendar_event_id?: string | null;
}

/** פריסט מהיר לכותרת מטלה (למשל "לחזור ל...") — משותף לכל הצוות. */
export interface TaskPreset {
  preset_id: string;
  title: string;
  created_by_user_id: string;
}

export type CalendarEventType = "sales_meeting" | "option_hold" | "confirmed_event" | "meeting";

export const CALENDAR_EVENT_COLORS: Record<CalendarEventType, string> = {
  sales_meeting: "#3b82f6", // כחול = פגישת מכירה/סיור
  confirmed_event: "#22c55e", // ירוק = אירוע סגור
  option_hold: "#eab308", // צהוב = תאריך משוריין / אופציה
  meeting: "#3b82f6", // ברירת מחדל בלבד — הצבע האמיתי נלקח לפי MEETING_TYPE_COLORS
};

export const CALENDAR_EVENT_LABELS: Record<CalendarEventType, string> = {
  sales_meeting: "פגישת מכירה / סיור",
  option_hold: "תאריך משוריין / אופציה",
  confirmed_event: "אירוע סגור",
  meeting: "פגישה עם הזוג",
};

export interface CalendarEvent {
  calendar_event_id: string;
  lead_id: string;
  event_type: CalendarEventType;
  start_time: string; // ISO datetime
  end_time: string; // ISO datetime
  created_by_user_id: string;
  meeting_id?: string; // קישור לרשומת MeetingEntry כש-event_type === "meeting"
}

// דריסה ידנית של תווית "היתר נישואין לספרדים" ליום ספציפי (date בפורמט
// YYYY-MM-DD, doc id בפיירסטור) — text=null אומר שהתווית הוסתרה ביד לתאריך
// הזה, למרות שהוא נופל בטווח ההלכתי המחושב.
export interface CalendarNoteOverride {
  date: string;
  text: string | null;
}

// הערה חופשית של המשתמש על תאריך ספציפי ביומן (למשל "יש הקמות ביום הזה, לא
// למכור אירוע") + צבע לסימון התא. doc id הוא התאריך (YYYY-MM-DD) — בדומה
// ל-CalendarNoteOverride, אבל זו הערה כללית של המשתמש, לא דריסת ההיתר ההלכתי.
export type DateNoteColor = "red" | "amber" | "green" | "blue" | "purple";

export const DATE_NOTE_COLORS: Record<DateNoteColor, string> = {
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
};

export interface DateNote {
  date: string;
  text: string;
  color: DateNoteColor;
}

// מעקב פגישות עם הזוג (פגישה ראשונה/נוספת/שלישית/טעימות) — רשימה דינמית,
// לא שדות קבועים, כי לזוג מסוים יכולות להיות כמה "פגישות נוספות" בפועל.
// "expectations" (תיאום ציפיות) מוצע רק לאירוע סגור — הפגישה הזו קורית אחרי
// שהעסקה נסגרה, מול מנהל האירוע ולא מול נציג המכירות.
export type MeetingType = "first" | "additional" | "third" | "tasting" | "expectations";

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  first: "פגישה ראשונה",
  additional: "פגישה נוספת",
  third: "פגישה שלישית",
  tasting: "טעימות",
  expectations: "תיאום ציפיות",
};

export const MEETING_TYPE_COLORS: Record<MeetingType, string> = {
  first: "#3b82f6", // כחול
  additional: "#ec4899", // ורוד
  third: "#eab308", // צהוב
  tasting: "#f97316", // כתום
  expectations: "#14b8a6", // טורקיז
};

/** סוגי פגישה שרלוונטיים רק אחרי סגירת האירוע. */
export const CLOSED_ONLY_MEETING_TYPES: MeetingType[] = ["expectations"];

// ── תכנון האירוע (תיאום ציפיות) ─────────────────────────────────────────────
// נשמר כאובייקט יחיד על מסמך הליד, לא כתת-אוסף: הוא תמיד נקרא ונכתב כשלם
// יחד עם הכרטיס, ואין עליו שאילתות. פרטי הזוג/תאריך/מוזמנים לא חוזרים לכאן
// בכוונה — הם נשארים מקור אמת יחיד על הליד עצמו.

export interface PlanningScheduleRow {
  row_id: string;
  time: string; // "HH:mm"
  label: string;
  note?: string;
}

export interface PlanningSupplierRow {
  row_id: string;
  role: string;
  name?: string;
  phone?: string;
  note?: string;
}

// שבעת גושי הטופס — פריסט קובע אילו מהם מוצגים לסוג אירוע נתון (ברית לא
// צריכה סדר חופה, אירוע חברה לא צריך בקשות כשרות וכו').
export const PLANNING_SECTION_KEYS = [
  "family",
  "schedule",
  "suppliers",
  "chupa",
  "equipment",
  "special",
  "general",
] as const;
export type PlanningSectionKey = (typeof PLANNING_SECTION_KEYS)[number];

export const PLANNING_SECTION_LABELS: Record<PlanningSectionKey, string> = {
  family: "בני משפחה נוספים",
  schedule: "לוז אירוע",
  suppliers: "רשימת ספקים",
  chupa: "סדר החופה",
  equipment: "ציוד שהזוג מביא",
  special: "בקשות מיוחדות",
  general: "הערות כלליות",
};

/**
 * פריסט תכנון אירוע — אוסף org-scoped שהאדמין מנהל בהגדרות (כמו סוגי אירוע
 * והקטלוג). event_type_id משייך את הפריסט לסוג אירוע ספציפי לשיוך אוטומטי;
 * null/undefined = פריסט כללי שמוצע לבחירה ידנית כשאין שיוך מתאים.
 */
export interface PlanningPreset {
  preset_id: string;
  name: string;
  event_type_id?: string | null;
  sections: PlanningSectionKey[];
  created_at: string;
}

export interface EventPlanning {
  /** הפריסט שהיה בשימוש בשמירה האחרונה — לא בהכרח משויך אוטומטית (יכול היה להיבחר ידנית). */
  preset_id?: string;
  /** event_type_id של הכרטיס בזמן השמירה האחרונה — לזיהוי שסוג האירוע השתנה מאז. */
  planned_event_type_id?: string;
  family_notes?: string;
  schedule: PlanningScheduleRow[];
  schedule_notes?: string;
  suppliers: PlanningSupplierRow[];
  chupa_groom_with?: string;
  chupa_groom_song?: string;
  chupa_bride_with?: string;
  chupa_bride_song?: string;
  chupa_best_man?: string;
  chupa_ring_bearer?: string;
  chupa_witness?: string;
  chupa_attendees?: string[];
  chupa_wine?: string;
  chupa_notes?: string;
  equip_rings?: boolean;
  equip_tallit?: boolean;
  equip_glass?: boolean;
  equip_extra?: string;
  special_allergies?: string;
  special_vegan?: string;
  special_glatt?: string;
  general_notes?: string;
  updated_at?: string;
  updated_by_user_id?: string;
}

export const DEFAULT_PLANNING_SCHEDULE: { time: string; label: string }[] = [
  { time: "19:30", label: "קבלת פנים" },
  { time: "20:20", label: "כתובה" },
  { time: "21:00", label: "חופה" },
  { time: "21:20", label: "כניסה + הושבה" },
  { time: "21:45", label: "ריקודים" },
  { time: "22:30", label: "מנת ביניים" },
  { time: "23:00", label: "ארוחה עיקרית" },
  { time: "23:45", label: "עוגה" },
];

export const DEFAULT_PLANNING_SUPPLIER_ROLES = [
  "רב / עורך טקס",
  "תקליטן / DJ",
  "צלם",
  "צלם וידאו",
  "מנהל אולם",
  "מנהל בר",
  "מעצב אולם",
  "אטרקציות",
  "מגנטים",
];

export const CHUPA_ATTENDEE_OPTIONS = [
  "אחים חתן",
  "אחים כלה",
  "סבא/סבתא חתן",
  "סבא/סבתא כלה",
];

export const CHUPA_WINE_OPTIONS = ["אדום", "לבן", "אין"];

/** ספק במאגר הארגוני — נבחר מתוך טופס התכנון במקום להקליד אותו בכל אירוע. */
export interface OrgSupplier {
  supplier_id: string;
  name: string;
  role?: string;
  phone?: string;
  note?: string;
  /** ספק שעשה בעיות בעבר — מוזהר עליו בבחירה מהאוטוקומפליט בטופס התכנון. */
  blacklisted?: boolean;
  created_at: string;
}

// "done" לא נשמר בנתונים — הוא נגזר אוטומטית (תאריך עבר ולא בוטלה),
// ר' getMeetingEffectiveState. רק "scheduled"/"cancelled" הם מצבים אמיתיים.
export type MeetingStatus = "scheduled" | "cancelled";

export interface MeetingEntry {
  meeting_id: string;
  type: MeetingType;
  date?: string | null; // ISO date
  time?: string | null; // "HH:mm"
  notes?: string; // הערה חופשית, למשל "באים רק לראות את המקום" / "מגיעים עם ההורים"
  status: MeetingStatus;
  created_at: string;
  created_by_user_id: string;
  cancelled_by_user_id?: string | null;
  cancelled_at?: string | null;
  // תשתית לאוטומציית תזכורת/אישור הגעה (וואטסאפ/SMS) — לא בשימוש עדיין,
  // אבל השדות קיימים כדי שחיבור API עתידי לא ידרוש שינוי מודל.
  confirmation_token?: string;
  confirmation_status?: "pending" | "confirmed" | "declined";
  confirmation_sent_at?: string | null;
}

export type MeetingEffectiveState = "scheduled" | "done" | "cancelled";

export function getMeetingEffectiveState(m: MeetingEntry): MeetingEffectiveState {
  if (m.status === "cancelled") return "cancelled";
  if (m.date && new Date(m.date) < new Date(new Date().toDateString())) return "done";
  return "scheduled";
}
