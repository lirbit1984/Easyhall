"use client";

import { useOrg } from "./org-context";

/**
 * מי רשאי לערוך את טופס תיאום הציפיות: admin ומנהל אירוע תמיד, נציג מכירות
 * רק אם האדמין הדליק לו את ההרשאה בניהול הצוות. "משרד" לעולם לא — הוא צופה
 * ומדפיס בלבד.
 */
export function useCanEditPlanning(): boolean {
  const { currentOrgId, memberships } = useOrg();
  const membership = memberships.find((m) => m.orgId === currentOrgId);
  if (!membership) return false;
  if (membership.role === "admin" || membership.role === "event_manager") return true;
  if (membership.role === "sales_rep") return !!membership.permissions?.canEditPlanning;
  return false;
}
