import type {
  User,
  LeadEvent,
  ActivityFeedItem,
  Task,
  CalendarEvent,
  Milestone,
  CatalogItem,
  TaskPreset,
} from "./types";

// ------------------------------------------------------------------
// משתמשים (Users) - עד 10 משתמשים בשלב א'
// ------------------------------------------------------------------
export const MOCK_USERS: User[] = [
  {
    user_id: "u1",
    full_name: "רועי כהן",
    email: "roi@easyhall.co.il",
    phone: "050-1234567",
    role: "admin",
    is_active: true,
    avatar_color: "#6366f1",
    created_at: "2024-01-01T08:00:00",
  },
  {
    user_id: "u2",
    full_name: "מאיה לוי",
    email: "maya@easyhall.co.il",
    phone: "052-2345678",
    role: "sales_rep",
    is_active: true,
    avatar_color: "#ec4899",
    created_at: "2024-01-05T08:00:00",
  },
  {
    user_id: "u3",
    full_name: "דניאל אברהם",
    email: "daniel@easyhall.co.il",
    phone: "054-3456789",
    role: "sales_rep",
    is_active: true,
    avatar_color: "#0ea5e9",
    created_at: "2024-02-01T08:00:00",
  },
  {
    user_id: "u4",
    full_name: "נועה שמעוני",
    email: "noa@easyhall.co.il",
    phone: "053-4567890",
    role: "office",
    is_active: true,
    avatar_color: "#22c55e",
    created_at: "2024-03-01T08:00:00",
  },
  {
    user_id: "u5",
    full_name: "עומר פרץ",
    email: "omer@easyhall.co.il",
    phone: "058-5678901",
    role: "sales_rep",
    is_active: true,
    avatar_color: "#f59e0b",
    created_at: "2024-03-15T08:00:00",
  },
];

export const CURRENT_USER: User = MOCK_USERS[1]; // מאיה לוי - נציגת מכירות מחוברת

export function getUserById(id: string): User | undefined {
  return MOCK_USERS.find((u) => u.user_id === id);
}

// ------------------------------------------------------------------
// אבני דרך ברירת מחדל לליד חדש
// ------------------------------------------------------------------
function defaultMilestones(overrides: Partial<Record<string, boolean>> = {}): Milestone[] {
  const base: Milestone[] = [
    { key: "first_contact", label: "פנייה ראשונית בוצעה", done: true },
    { key: "meeting_scheduled", label: "פגישה נקבעה", done: false },
    { key: "site_visit_done", label: "סיור באולם בוצע", done: false },
    { key: "quote_sent", label: "הצעת מחיר נשלחה", done: false },
    { key: "deposit_paid", label: "מקדמה שולמה", done: false },
    { key: "contract_signed", label: "חוזה נחתם", done: false },
    { key: "menu_finalized", label: "תפריט סופי סוכם", done: false },
  ];
  return base.map((m) => (m.key in overrides ? { ...m, done: !!overrides[m.key] } : m));
}

// ------------------------------------------------------------------
// לידים ואירועים (Leads_Events)
// ------------------------------------------------------------------
const now = new Date();
function daysFromNow(n: number, hour = 10, minute = 0) {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function daysAgo(n: number, hour = 10, minute = 0) {
  return daysFromNow(-n, hour, minute);
}

export const MOCK_LEADS: LeadEvent[] = [
  {
    lead_id: "l1",
    partner_1_name: "איתי מזרחי",
    partner_2_name: "שירן מזרחי",
    phone_primary: "050-1112222",
    phone_secondary: "052-1112223",
    email: "itay.shiran@example.com",
    lead_source: "פייסבוק",
    assigned_user_id: "u2",
    status: "potential",
    pipeline_stage: "initial_contact",
    event_date: daysFromNow(120),
    event_season_preferred: "סתיו 2026",
    estimated_guests: 220,
    price_per_plate: 320,
    milestones: defaultMilestones(),
    documents: [],
    created_at: daysAgo(2),
    created_by_user_id: "u2",
    follow_up_at: daysAgo(1, 9, 0), // באיחור
  },
  {
    lead_id: "l2",
    partner_1_name: "יובל כץ",
    partner_2_name: "אן כץ",
    phone_primary: "054-2223333",
    email: "yuval.ann@example.com",
    lead_source: "אינסטגרם",
    assigned_user_id: "u3",
    status: "potential",
    pipeline_stage: "meeting_set",
    event_date: daysFromNow(90),
    event_season_preferred: "אביב 2026",
    estimated_guests: 180,
    price_per_plate: 290,
    milestones: defaultMilestones({ meeting_scheduled: true }),
    documents: [],
    created_at: daysAgo(10),
    created_by_user_id: "u3",
    follow_up_at: daysFromNow(1, 14, 0),
  },
  {
    lead_id: "l3",
    partner_1_name: "רון בן-דוד",
    partner_2_name: "קרן בן-דוד",
    phone_primary: "052-3334444",
    email: "ron.keren@example.com",
    lead_source: "המלצה",
    assigned_user_id: "u2",
    status: "potential",
    pipeline_stage: "meeting_done",
    event_date: daysFromNow(75),
    estimated_guests: 300,
    price_per_plate: 350,
    milestones: defaultMilestones({ meeting_scheduled: true, site_visit_done: true }),
    documents: [],
    created_at: daysAgo(20),
    created_by_user_id: "u2",
    follow_up_at: daysAgo(3, 11, 0), // באיחור
  },
  {
    lead_id: "l4",
    partner_1_name: "אלון שרון",
    partner_2_name: "מיכל שרון",
    phone_primary: "053-4445555",
    email: "alon.michal@example.com",
    lead_source: "גוגל",
    assigned_user_id: "u5",
    status: "potential",
    pipeline_stage: "quote_sent",
    event_date: daysFromNow(60),
    estimated_guests: 250,
    price_per_plate: 310,
    milestones: defaultMilestones({
      meeting_scheduled: true,
      site_visit_done: true,
      quote_sent: true,
    }),
    documents: [
      {
        doc_id: "d1",
        name: "הצעת מחיר - אלון ומיכל שרון.pdf",
        type: "quote",
        url: "#",
        created_at: daysAgo(5),
      },
    ],
    created_at: daysAgo(30),
    created_by_user_id: "u5",
    follow_up_at: daysFromNow(2, 10, 0),
  },
  {
    lead_id: "l5",
    partner_1_name: "גיא אדרי",
    partner_2_name: "ליה אדרי",
    phone_primary: "058-5556666",
    email: "guy.lia@example.com",
    lead_source: "תערוכת חתונות",
    assigned_user_id: "u3",
    status: "closed",
    pipeline_stage: "closed_won",
    event_date: daysFromNow(45),
    estimated_guests: 400,
    price_per_plate: 380,
    milestones: defaultMilestones({
      meeting_scheduled: true,
      site_visit_done: true,
      quote_sent: true,
      deposit_paid: true,
      contract_signed: true,
    }),
    documents: [
      {
        doc_id: "d2",
        name: "חוזה התקשרות - גיא וליה אדרי.pdf",
        type: "contract",
        url: "#",
        created_at: daysAgo(8),
      },
    ],
    created_at: daysAgo(60),
    created_by_user_id: "u3",
    follow_up_at: null,
  },
  {
    lead_id: "l6",
    partner_1_name: "טל גולן",
    partner_2_name: "נועה גולן",
    phone_primary: "050-6667777",
    lead_source: "וואטסאפ נכנס",
    assigned_user_id: "u2",
    status: "potential",
    pipeline_stage: "initial_contact",
    event_date: null,
    estimated_guests: 150,
    price_per_plate: 280,
    milestones: defaultMilestones(),
    documents: [],
    created_at: daysAgo(1),
    created_by_user_id: "u2",
    follow_up_at: daysFromNow(0, 16, 0), // היום
  },
  {
    lead_id: "l7",
    partner_1_name: "אורי נחום",
    partner_2_name: "שני נחום",
    phone_primary: "054-7778888",
    email: "uri.shani@example.com",
    lead_source: "פייסבוק",
    assigned_user_id: "u5",
    status: "potential",
    pipeline_stage: "meeting_set",
    event_date: daysFromNow(150),
    estimated_guests: 200,
    price_per_plate: 300,
    milestones: defaultMilestones({ meeting_scheduled: true }),
    documents: [],
    created_at: daysAgo(4),
    created_by_user_id: "u5",
    follow_up_at: daysFromNow(3, 12, 0),
  },
  {
    lead_id: "l8",
    partner_1_name: "בן זיו",
    partner_2_name: "הדר זיו",
    phone_primary: "052-8889999",
    lead_source: "המלצה",
    assigned_user_id: "u3",
    status: "not_relevant",
    pipeline_stage: "initial_contact",
    event_date: null,
    estimated_guests: 100,
    price_per_plate: 250,
    milestones: defaultMilestones(),
    documents: [],
    created_at: daysAgo(15),
    created_by_user_id: "u3",
    follow_up_at: null,
  },
  {
    lead_id: "l9",
    partner_1_name: "עידן וייס",
    partner_2_name: "רותם וייס",
    phone_primary: "053-9990000",
    email: "idan.rotem@example.com",
    lead_source: "אתר האולם",
    assigned_user_id: "u2",
    status: "potential",
    pipeline_stage: "meeting_done",
    event_date: daysFromNow(100),
    estimated_guests: 260,
    price_per_plate: 330,
    milestones: defaultMilestones({ meeting_scheduled: true, site_visit_done: true }),
    documents: [],
    created_at: daysAgo(12),
    created_by_user_id: "u2",
    follow_up_at: daysFromNow(5, 10, 0),
  },
  {
    lead_id: "l10",
    partner_1_name: "נדב אשכנזי",
    partner_2_name: "יעל אשכנזי",
    phone_primary: "058-0001111",
    lead_source: "אינסטגרם",
    assigned_user_id: "u5",
    status: "potential",
    pipeline_stage: "quote_sent",
    event_date: daysFromNow(80),
    estimated_guests: 320,
    price_per_plate: 340,
    milestones: defaultMilestones({
      meeting_scheduled: true,
      site_visit_done: true,
      quote_sent: true,
    }),
    documents: [
      {
        doc_id: "d3",
        name: "הצעת מחיר - נדב ויעל אשכנזי.pdf",
        type: "quote",
        url: "#",
        created_at: daysAgo(3),
      },
    ],
    created_at: daysAgo(25),
    created_by_user_id: "u5",
    follow_up_at: daysAgo(2, 9, 30), // באיחור
  },
  {
    lead_id: "l11",
    partner_1_name: "אסף רימון",
    partner_2_name: "חן רימון",
    phone_primary: "050-2223344",
    lead_source: "גוגל",
    assigned_user_id: "u3",
    status: "closed",
    pipeline_stage: "closed_won",
    event_date: daysFromNow(30),
    estimated_guests: 180,
    price_per_plate: 300,
    milestones: defaultMilestones({
      meeting_scheduled: true,
      site_visit_done: true,
      quote_sent: true,
      deposit_paid: true,
      contract_signed: true,
      menu_finalized: true,
    }),
    documents: [
      {
        doc_id: "d4",
        name: "חוזה התקשרות - אסף וחן רימון.pdf",
        type: "contract",
        url: "#",
        created_at: daysAgo(40),
      },
    ],
    created_at: daysAgo(70),
    created_by_user_id: "u3",
    follow_up_at: null,
  },
  {
    lead_id: "l12",
    partner_1_name: "יאיר סבן",
    partner_2_name: "מור סבן",
    phone_primary: "052-3345566",
    lead_source: "תערוכת חתונות",
    assigned_user_id: "u2",
    status: "potential",
    pipeline_stage: "initial_contact",
    event_date: null,
    estimated_guests: 140,
    price_per_plate: 270,
    milestones: defaultMilestones(),
    documents: [],
    created_at: daysAgo(0),
    created_by_user_id: "u2",
    follow_up_at: daysFromNow(0, 18, 0), // היום
  },
];

export function getLeadById(id: string): LeadEvent | undefined {
  return MOCK_LEADS.find((l) => l.lead_id === id);
}

// ------------------------------------------------------------------
// פיד תקשורת ותיעוד (Activity_Feed / Audit_Log)
// ------------------------------------------------------------------
export const MOCK_ACTIVITY: ActivityFeedItem[] = [
  {
    activity_id: "a1",
    lead_id: "l1",
    user_id: "u2",
    activity_type: "note",
    content: "הליד יצר קשר דרך פייסבוק, מעוניינים בתאריך בסתיו.",
    created_at: daysAgo(2, 9, 15),
  },
  {
    activity_id: "a2",
    lead_id: "l1",
    user_id: "u2",
    activity_type: "outgoing_call",
    content: "שיחה ראשונית - תיאום ציפיות לגבי כמות אורחים ותקציב.",
    created_at: daysAgo(2, 9, 30),
  },
  {
    activity_id: "a3",
    lead_id: "l2",
    user_id: "u3",
    activity_type: "whatsapp",
    content: "נשלחה הודעת WhatsApp עם פרטי האולם ותמונות מהאירועים האחרונים.",
    created_at: daysAgo(9, 11, 0),
  },
  {
    activity_id: "a4",
    lead_id: "l2",
    user_id: "u3",
    activity_type: "status_change",
    content: "סטטוס שונה: פנייה ראשונית ➔ נקבעה פגישה.",
    created_at: daysAgo(8, 16, 20),
  },
  {
    activity_id: "a5",
    lead_id: "l3",
    user_id: "u2",
    activity_type: "meeting",
    content: "סיור באולם בוצע, הזוג התרשם מאוד מהעיצוב והתאורה.",
    created_at: daysAgo(5, 17, 0),
  },
  {
    activity_id: "a6",
    lead_id: "l4",
    user_id: "u5",
    activity_type: "note",
    content: "נשלחה הצעת מחיר עדכנית הכוללת שדרוג בר ותאורה.",
    created_at: daysAgo(5, 10, 0),
  },
  {
    activity_id: "a7",
    lead_id: "l5",
    user_id: "u3",
    activity_type: "status_change",
    content: "סטטוס שונה: נשלחה הצעת מחיר ➔ נסגר (Closed Won). מקדמה שולמה.",
    created_at: daysAgo(8, 13, 45),
  },
  {
    activity_id: "a8",
    lead_id: "l9",
    user_id: "u2",
    activity_type: "incoming_call",
    content: "הזוג התקשר לברר לגבי אפשרויות תפריט צמחוני/טבעוני.",
    created_at: daysAgo(3, 15, 10),
  },
];

export function getActivityForLead(leadId: string): ActivityFeedItem[] {
  return MOCK_ACTIVITY.filter((a) => a.lead_id === leadId).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ------------------------------------------------------------------
// משימות (Tasks)
// ------------------------------------------------------------------
export const MOCK_TASKS: Task[] = [
  {
    task_id: "t1",
    lead_id: "l1",
    assigned_user_id: "u2",
    created_by_user_id: "u2",
    title: "לחזור לאיתי ושירן מזרחי לגבי תאריך אירוע",
    due_date: daysAgo(1, 9, 0),
    is_completed: false,
    created_at: daysAgo(6, 8, 0),
  },
  {
    task_id: "t2",
    lead_id: "l3",
    assigned_user_id: "u2",
    created_by_user_id: "u2",
    title: "לשלוח הצעת מחיר לרון וקרן בן-דוד",
    due_date: daysAgo(3, 11, 0),
    is_completed: false,
    created_at: daysAgo(5, 10, 0),
  },
  {
    task_id: "t3",
    lead_id: "l6",
    assigned_user_id: "u2",
    created_by_user_id: "u2",
    title: "לתאם פגישת סיור עם טל ונועה גולן",
    due_date: daysFromNow(0, 16, 0),
    is_completed: false,
    created_at: daysAgo(4, 9, 0),
  },
  {
    task_id: "t4",
    lead_id: "l10",
    assigned_user_id: "u5",
    created_by_user_id: "u5",
    title: "מעקב אחרי הצעת מחיר שנשלחה - נדב ויעל אשכנזי",
    due_date: daysAgo(2, 9, 30),
    is_completed: false,
    created_at: daysAgo(3, 9, 0),
  },
  {
    task_id: "t5",
    lead_id: "l12",
    assigned_user_id: "u2",
    created_by_user_id: "u2",
    title: "פנייה ראשונית ליאיר ומור סבן",
    due_date: daysFromNow(0, 18, 0),
    is_completed: false,
    created_at: daysAgo(2, 9, 0),
  },
  {
    task_id: "t6",
    lead_id: "l2",
    assigned_user_id: "u3",
    created_by_user_id: "u3",
    title: "אישור פגישה ליובל ואן כץ למחר",
    due_date: daysFromNow(1, 14, 0),
    is_completed: false,
    created_at: daysAgo(1, 9, 0),
  },
  {
    task_id: "t7",
    lead_id: "l5",
    assigned_user_id: "u3",
    created_by_user_id: "u1",
    title: "לוודא קבלת חוזה חתום מגיא וליה אדרי",
    due_date: daysAgo(7, 10, 0),
    is_completed: true,
    completed_at: daysAgo(6, 12, 0),
    created_at: daysAgo(9, 9, 0),
  },
  {
    task_id: "t8",
    lead_id: null,
    assigned_user_id: "u4",
    created_by_user_id: "u1",
    title: "עדכון תפריט האולם לעונת הסתיו",
    due_date: daysFromNow(7, 12, 0),
    is_completed: false,
    created_at: daysAgo(0, 8, 0),
  },
];

// ------------------------------------------------------------------
// יומן אירועים (Calendar_Events)
// ------------------------------------------------------------------
export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    calendar_event_id: "c1",
    lead_id: "l2",
    event_type: "sales_meeting",
    start_time: daysFromNow(1, 14, 0),
    end_time: daysFromNow(1, 15, 0),
    created_by_user_id: "u3",
  },
  {
    calendar_event_id: "c2",
    lead_id: "l3",
    event_type: "sales_meeting",
    start_time: daysAgo(5, 16, 0),
    end_time: daysAgo(5, 17, 0),
    created_by_user_id: "u2",
  },
  {
    calendar_event_id: "c3",
    lead_id: "l5",
    event_type: "confirmed_event",
    start_time: daysFromNow(45, 19, 0),
    end_time: daysFromNow(45, 23, 59),
    created_by_user_id: "u3",
  },
  {
    calendar_event_id: "c4",
    lead_id: "l11",
    event_type: "confirmed_event",
    start_time: daysFromNow(30, 19, 0),
    end_time: daysFromNow(30, 23, 59),
    created_by_user_id: "u3",
  },
  {
    calendar_event_id: "c5",
    lead_id: "l4",
    event_type: "option_hold",
    start_time: daysFromNow(60, 19, 0),
    end_time: daysFromNow(60, 23, 59),
    created_by_user_id: "u5",
  },
  {
    calendar_event_id: "c6",
    lead_id: "l10",
    event_type: "option_hold",
    start_time: daysFromNow(80, 19, 0),
    end_time: daysFromNow(80, 23, 59),
    created_by_user_id: "u5",
  },
  {
    calendar_event_id: "c7",
    lead_id: "l7",
    event_type: "sales_meeting",
    start_time: daysFromNow(3, 12, 0),
    end_time: daysFromNow(3, 13, 0),
    created_by_user_id: "u5",
  },
  {
    calendar_event_id: "c8",
    lead_id: "l9",
    event_type: "sales_meeting",
    start_time: daysFromNow(5, 10, 0),
    end_time: daysFromNow(5, 11, 0),
    created_by_user_id: "u2",
  },
];

export const LEAD_SOURCES = [
  "פייסבוק",
  "אינסטגרם",
  "המלצה",
  "גוגל",
  "תערוכת חתונות",
  "וואטסאפ נכנס",
  "אתר האולם",
];

// ------------------------------------------------------------------
// מאגר פריטים למכירה (Catalog) - מה שהאדמין מגדיר שאפשר להוסיף לעגלה
// ------------------------------------------------------------------
export const MOCK_CATALOG: CatalogItem[] = [
  { item_id: "cat1", name: "מנה בסיסית", unit: "per_guest", price: 250, active: true, sort_order: 1 },
  { item_id: "cat2", name: "בר משקאות", unit: "per_guest", price: 45, active: true, sort_order: 2 },
  { item_id: "cat3", name: "עיצוב ופרחים", unit: "per_guest", price: 60, active: true, sort_order: 3 },
  { item_id: "cat4", name: "הגברה ותאורה", unit: "fixed", price: 4500, active: true, sort_order: 4 },
  { item_id: "cat5", name: "צלם סטילס", unit: "fixed", price: 5500, active: true, sort_order: 5 },
];

// ------------------------------------------------------------------
// פריסטים מהירים לכותרת מטלה — משותפים לכל הצוות
// ------------------------------------------------------------------
export const MOCK_TASK_PRESETS: TaskPreset[] = [
  { preset_id: "tp1", title: "לחזור ל...", created_by_user_id: CURRENT_USER.user_id },
  { preset_id: "tp2", title: "תשלום אקו״ם ל...", created_by_user_id: CURRENT_USER.user_id },
  { preset_id: "tp3", title: "לשלוח הצעת מחיר ל...", created_by_user_id: CURRENT_USER.user_id },
];
