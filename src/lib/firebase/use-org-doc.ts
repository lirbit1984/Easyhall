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
  // שיעור מע"מ באחוזים לחישוב עגלת התשלומים; ארגונים ותיקים בלי השדה
  // מקבלים ברירת מחדל 18 בקוד הקורא (DEFAULT_VAT_PERCENT).
  vatPercent?: number;
  // אופן חישוב המקדמה: "percent" = אחוז מתוך סה"כ העגלה (depositPercent),
  // "fixed" = סכום קבוע בש"ח (depositAmount) בלי קשר לסכום העגלה. ארגונים
  // ותיקים בלי depositMode נחשבים "percent" (ההתנהגות הישנה).
  depositMode?: "percent" | "fixed";
  depositPercent?: number;
  depositAmount?: number;
  // לוגו האולם — מוצג בכותרת הצעת מחיר/חוזה. מועלה בהגדרות (admin בלבד).
  logoUrl?: string;
  // תוספת הסעיפים המשפטיים שהופכת הצעת מחיר לחוזה — טקסט חופשי שהאולם
  // עצמו קובע/עורך בהגדרות (admin בלבד).
  contractLegalText?: string;
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
