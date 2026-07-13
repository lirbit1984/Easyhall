export type OrgRole = "admin" | "sales_rep" | "office";

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: OrgRole;
  fullName: string;
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
