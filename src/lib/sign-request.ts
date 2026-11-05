import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, isFirebaseConfigured } from "./firebase/client";

/**
 * בקשת חתימה על חוזה: הזוג פותח /sign/{token} בלי התחברות, קורא, חותם באצבע
 * ומאשר. המסמך יושב באוסף שורש `signRequests` — קריא לכל מי שמחזיק בטוקן
 * (allow get, בלי list), בדיוק כמו shortLinks. החתימה עצמה נכתבת רק דרך
 * Cloud Function (signContract), שגם מסמנת "חוזה נחתם" בכרטיס האירוע.
 *
 * מצב דמו (בלי Firebase): נשמר ב-localStorage כדי שאפשר יהיה לראות את הזרימה.
 */

export interface SignRequestDoc {
  orgId: string;
  leadId: string;
  orgName: string;
  logoUrl?: string;
  title: string;
  pdfUrl: string;
  eventDate: string | null;
  guests: number;
  total: number;
  status: "pending" | "signed";
  created_at: string;
  signed?: { name: string; id_number: string; signature: string; signed_at: string };
}

// אותו אלפבית כמו short-link: בלי 0/o/1/l/i. 16 תווים — לא ניתן לניחוש.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

const mockKey = (token: string) => `signRequest:${token}`;

export async function createSignRequest(
  data: Omit<SignRequestDoc, "status" | "created_at" | "signed">
): Promise<string> {
  const token = randomToken();
  const payload: SignRequestDoc = JSON.parse(JSON.stringify({ ...data, status: "pending", created_at: new Date().toISOString() }));
  if (isFirebaseConfigured && db) await setDoc(doc(db, "signRequests", token), payload);
  else localStorage.setItem(mockKey(token), JSON.stringify(payload));
  return `${window.location.origin}/sign/${token}`;
}

export async function getSignRequest(token: string): Promise<SignRequestDoc | null> {
  if (isFirebaseConfigured && db) {
    const snap = await getDoc(doc(db, "signRequests", token));
    return snap.exists() ? (snap.data() as SignRequestDoc) : null;
  }
  const raw = localStorage.getItem(mockKey(token));
  return raw ? (JSON.parse(raw) as SignRequestDoc) : null;
}

export async function submitSignature(
  token: string,
  data: { name: string; id_number: string; signature: string }
): Promise<void> {
  if (isFirebaseConfigured && functions) {
    await httpsCallable(functions, "signContract")({ token, ...data });
    return;
  }
  const req = await getSignRequest(token);
  if (!req) throw new Error("הקישור לא נמצא");
  localStorage.setItem(mockKey(token), JSON.stringify({ ...req, status: "signed", signed: { ...data, signed_at: new Date().toISOString() } }));
}
