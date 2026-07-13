"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./client";
import { useOrg } from "./org-context";

export interface OrgSubscription {
  plan: "trial" | "basic" | "pro";
  status: "trialing" | "active" | "expired";
  trialEndsAt?: Timestamp;
}

export interface OrgDoc {
  name: string;
  paymentConnected?: boolean;
  paymentProvider?: string;
  subscription?: OrgSubscription;
}

interface SnapshotState {
  orgId: string;
  doc: OrgDoc | null;
}

/**
 * מאזין למסמך הארגון הנוכחי (שם, חיבור סליקה, מנוי).
 * ארגונים ותיקים בלי שדה subscription נחשבים active (grandfathered) —
 * הקוד הקורא צריך להתייחס ל-undefined בהתאם.
 *
 * ה-state נכתב רק מתוך callbacks של onSnapshot (לא סינכרונית בגוף ה-effect);
 * "loading" ו"אין ארגון" נגזרים מהשוואת ה-orgId של הסנאפשוט האחרון לנוכחי.
 */
export function useOrgDoc(): { orgDoc: OrgDoc | null; loading: boolean } {
  const { currentOrgId } = useOrg();
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !currentOrgId) return;
    return onSnapshot(
      doc(db, "organizations", currentOrgId),
      (snap) => {
        setSnapshot({ orgId: currentOrgId, doc: snap.exists() ? (snap.data() as OrgDoc) : null });
      },
      (err) => {
        console.error("[useOrgDoc] failed", err);
        setSnapshot({ orgId: currentOrgId, doc: null });
      }
    );
  }, [currentOrgId]);

  const active = isFirebaseConfigured && !!db && !!currentOrgId;
  const isCurrent = active && snapshot?.orgId === currentOrgId;
  return {
    orgDoc: isCurrent ? (snapshot?.doc ?? null) : null,
    loading: active && !isCurrent,
  };
}
