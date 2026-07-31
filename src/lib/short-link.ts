import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase/client";

/**
 * קישורים קצרים לשיתוף מסמכים עם הזוג.
 *
 * כתובת ההורדה של Firebase Storage היא ענקית (נתיב מקודד + טוקן גישה), ונראית
 * זולה כששולחים אותה בוואטסאפ. במקום זה שומרים מיפוי code -> url באוסף שורש
 * `shortLinks` ומגישים אותו דרך /f/{code}.
 *
 * הערת אבטחה: מסמך ה-shortLink קריא לכל אחד (allow get, בלי list) — בדיוק כמו
 * כתובת ההורדה המקורית, שגם היא נגישה לכל מי שמחזיק בטוקן. הקוד באורך 10 תווים
 * מאלפבית של 31 תווים (~8e14 אפשרויות) כדי שלא יהיה ניתן לניחוש.
 */

// בלי 0/o/1/l/i — כדי שאפשר יהיה להקריא קוד בטלפון בלי בלבול.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 10;

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export interface ShortLinkDoc {
  url: string;
  orgId: string;
  name: string;
  created_at: string;
}

/**
 * יוצר קישור קצר ומחזיר את הכתובת המלאה (כולל origin). אם Firebase לא מוגדר
 * (מצב דמו) מחזיר את הכתובת המקורית כדי שהשיתוף ימשיך לעבוד.
 */
export async function createShortLink(orgId: string, url: string, name: string): Promise<string> {
  if (!isFirebaseConfigured || !db || !orgId) return url;

  const code = randomCode();
  const payload: ShortLinkDoc = { url, orgId, name, created_at: new Date().toISOString() };
  await setDoc(doc(db, "shortLinks", code), payload);
  return `${window.location.origin}/f/${code}`;
}

export async function resolveShortLink(code: string): Promise<ShortLinkDoc | null> {
  if (!isFirebaseConfigured || !db) return null;
  const snap = await getDoc(doc(db, "shortLinks", code));
  return snap.exists() ? (snap.data() as ShortLinkDoc) : null;
}
