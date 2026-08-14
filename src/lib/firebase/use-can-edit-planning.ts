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
  if (membership.role === "sales_rep") {
    const areaLevel = membership.permissions?.areas?.planning;
    if (areaLevel) return areaLevel === "edit";
    return !!membership.permissions?.canEditPlanning; // legacy fallback for records written before the areas matrix included "planning"
  }
  return false;
}
