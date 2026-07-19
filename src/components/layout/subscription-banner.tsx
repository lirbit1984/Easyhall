"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, AlertTriangle } from "lucide-react";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";

/**
 * פס סטטוס מנוי מעל האפליקציה. ארגונים ותיקים ללא שדה subscription נחשבים
 * active ולא רואים כלום. חסימה קשיחה תופעל רק כשחיוב אמיתי (Grow) יחובר —
 * עד אז זו תזכורת רכה בלבד.
 */
export function SubscriptionBanner() {
  const { orgDoc } = useOrgDoc();
  // "עכשיו" נקבע פעם אחת בעליית הקומפוננטה — מדויק מספיק לספירת ימים,
  // ושומר על רינדור טהור (בלי Date.now בגוף הרינדור).
  const [now] = useState(() => Date.now());
  const sub = orgDoc?.subscription;
  if (!sub || sub.status === "active") return null;

  const endsAt = sub.trialEndsAt?.toDate?.();
  const daysLeft = endsAt ? Math.ceil((endsAt.getTime() - now) / (24 * 60 * 60 * 1000)) : null;

  if (sub.status === "trialing" && daysLeft !== null && daysLeft <= 0) {
    return (
      <div className="flex items-center justify-center gap-2 bg-destructive px-3 py-1.5 text-center text-xs font-medium text-white sm:text-sm">
        <AlertTriangle className="size-4 shrink-0" />
        תקופת הניסיון הסתיימה — יש לשדרג כדי להמשיך ללא הפרעה
        <Link href="/upgrade" className="underline underline-offset-2">
          שדרוג
        </Link>
      </div>
    );
  }

  if (sub.status === "trialing" && daysLeft !== null) {
    return (
      <div className="flex items-center justify-center gap-2 bg-primary/10 px-3 py-1.5 text-center text-xs font-medium text-primary sm:text-sm">
        <Clock className="size-4 shrink-0" />
        תקופת ניסיון — נותרו {daysLeft} ימים
        <Link href="/upgrade" className="underline underline-offset-2">
          שדרוג
        </Link>
      </div>
    );
  }

  return null;
}
