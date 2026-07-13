"use client";

import { useOrg } from "./org-context";
import { isFirebaseConfigured } from "./client";
import type { OrgRole } from "./types";

/** Current user's role in the active org. In demo mode (no Firebase) everyone is admin. */
export function useCurrentRole(): OrgRole {
  const { memberships, currentOrgId } = useOrg();
  if (!isFirebaseConfigured) return "admin";
  return memberships.find((m) => m.orgId === currentOrgId)?.role ?? "sales_rep";
}
