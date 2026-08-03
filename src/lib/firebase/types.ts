// event_manager (מנהל אירוע) נכנס לתמונה רק אחרי שהעסקה נסגרה: הוא מתאם
// ציפיות ומנהל את הלו"ז, ולכן אינו רואה לידים פתוחים, מחירים או כספים.
// accounting (הנהלת חשבונות) רואה רק את טאב "כספים ודוחות" בהגדרות — לא
// נכנס לשום מסך אחר במערכת (לא לידים, לא קנבן, לא שאר ההגדרות).
export type OrgRole = "admin" | "sales_rep" | "office" | "event_manager" | "accounting";

// תחומי הרשאה ניתנים להרחבה: כל תחום חדש נוסף כאן ומיד זמין במטריצת
// ההרשאות בהגדרות > ניהול > צוות, בלי לגעת בשאר הקוד.
export type PermissionAreaKey = "cart" | "menu" | "documents" | "calendar" | "tasks" | "finance";
export type PermissionLevel = "edit" | "view" | "none";

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "מנהל",
  sales_rep: "נציג מכירות",
  event_manager: "מנהל אירוע",
  office: "משרד",
  accounting: "הנהלת חשבונות",
};

export const PERMISSION_AREAS: { key: PermissionAreaKey; label: string }[] = [
  { key: "cart", label: "עגלת תשלומים" },
  { key: "menu", label: "תפריט" },
  { key: "documents", label: "מסמכים" },
  { key: "calendar", label: "יומן" },
  { key: "tasks", label: "משימות" },
  { key: "finance", label: "כספים ודוחות" },
];

/**
 * הרשאות נקודתיות שהאדמין מדליק לחבר צוות ספציפי, מעבר לתפקיד שלו.
 * canEditPlanning קיים מקודם (טופס תיאום הציפיות); areas היא המטריצה
 * הכללית והניתנת להרחבה לשאר תחומי המערכת.
 */
export interface MemberPermissions {
  canEditPlanning?: boolean;
  areas?: Partial<Record<PermissionAreaKey, PermissionLevel>>;
}

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: OrgRole;
  fullName: string;
  permissions?: MemberPermissions;
}

/**
 * users/{uid} — פרופיל אישי גלובלי, אחד לכל אדם בכל המערכת (לא לכל ארגון).
 * fullName הוא מקור האמת היחיד לשם התצוגה של המשתמש — onboarding כבר לא שואל
 * אותו מחדש, וה-Cloud Functions קוראות אותו משם בזמן יצירת/הצטרפות לארגון.
 * jobTitle הוא תווית חופשית לתצוגה בלבד — אינו קובע הרשאות (אלה נגזרות מה-role
 * שב-organizations/{orgId}/members/{uid}, שנקבע רק ע"י createOrganization/redeemInvite).
 */
export interface UserProfile {
  fullName: string;
  phone?: string;
  photoURL?: string;
  jobTitle?: string;
}
