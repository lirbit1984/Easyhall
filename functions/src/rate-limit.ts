import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const db = () => getFirestore();

/**
 * הגבלת קצב לפונקציות רגישות.
 *
 * המונים יושבים ב-rateLimits/{key} — אוסף ברמת השורש שאין לו כלל ב-firestore.rules
 * ולכן הוא נעול לחלוטין ללקוח (ברירת המחדל היא deny), ונגיש רק ל-Admin SDK.
 *
 * חלון קבוע ולא גולש: פשוט יותר, זול יותר בכתיבות, ומדויק מספיק כדי לעצור
 * הצפה. הספירה רצה בטרנזקציה כדי שקריאות מקבילות לא ידרסו זו את זו.
 */
export async function enforceRateLimit(opts: {
  /** מזהה ייחודי לפעולה+גורם, למשל `siteLead:203.0.113.7`. */
  key: string;
  /** מקסימום קריאות מותרות בחלון. */
  limit: number;
  /** אורך החלון במילישניות. */
  windowMs: number;
  /** מה שהמשתמש יראה כשהסף נחצה. */
  message: string;
}): Promise<void> {
  // doc id ב-Firestore לא יכול להכיל '/', ומוגבל ל-1500 בתים.
  const docId = opts.key.replace(/\//g, "_").slice(0, 200);
  const ref = db().collection("rateLimits").doc(docId);
  const now = Date.now();

  const allowed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const resetAt = (data?.resetAt as Timestamp | undefined)?.toMillis() ?? 0;

    // חלון חדש (או ראשון) — מאפסים את המונה.
    if (!snap.exists || resetAt <= now) {
      tx.set(ref, { count: 1, resetAt: Timestamp.fromMillis(now + opts.windowMs) });
      return true;
    }

    const count = Number(data?.count ?? 0);
    if (count >= opts.limit) return false;

    tx.update(ref, { count: count + 1 });
    return true;
  });

  if (!allowed) {
    throw new HttpsError("resource-exhausted", opts.message);
  }
}

/**
 * כתובת ה-IP של הקורא, לשימוש כמזהה בפונקציות שאינן דורשות התחברות.
 * מאחורי ה-load balancer של Cloud Functions הכתובת האמיתית היא הראשונה
 * ב-x-forwarded-for; rawRequest.ip לבדו יחזיר את ה-proxy.
 */
export function callerIp(rawRequest: { ip?: string; headers: Record<string, unknown> }): string {
  const forwarded = rawRequest.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded ?? "").split(",")[0];
  return (first || rawRequest.ip || "unknown").trim();
}
