import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const db = () => getFirestore();

const PIN_RE = /^\d{4}$/;
/** אחרי כמה ניסיונות כושלים המחיקה ננעלת ודורשת קוד שחרור. */
const MAX_ATTEMPTS = 3;

function hashPin(pin: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

function pinMatches(pin: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPin(pin, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

async function requireOrgAdmin(orgId: string, uid: string) {
  const snap = await db().collection("organizations").doc(orgId).collection("members").doc(uid).get();
  if (!snap.exists || snap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "רק מנהל יכול לבצע פעולה זו.");
  }
}

/**
 * שמירת קודי ה-PIN למחיקת כרטיס אירוע.
 *
 * הקודים נשמרים כ-hash ב-private/security, שאין אליו שום גישת לקוח. קודם הם
 * ישבו בטקסט גלוי על מסמך הארגון שכל חבר ארגון קורא — כלומר כל נציג יכול היה
 * פשוט לקרוא את הקוד. הפונקציה גם מנקה את השדות הישנים מהמסמך הציבורי.
 */
export const setSecurityPins = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  const deletePin = String(request.data?.deletePin ?? "").trim();
  const unlockPin = String(request.data?.deleteUnlockPin ?? "").trim();

  if (!orgId) throw new HttpsError("invalid-argument", "חסר מזהה ארגון.");
  if (!PIN_RE.test(deletePin) || !PIN_RE.test(unlockPin)) {
    throw new HttpsError("invalid-argument", "כל קוד חייב להיות בן 4 ספרות.");
  }
  if (deletePin === unlockPin) {
    throw new HttpsError("invalid-argument", "קוד המחיקה וקוד שחרור הנעילה חייבים להיות שונים.");
  }

  await requireOrgAdmin(orgId, request.auth.uid);

  const salt = randomBytes(16).toString("hex");
  const orgRef = db().collection("organizations").doc(orgId);
  const batch = db().batch();
  batch.set(orgRef.collection("private").doc("security"), {
    salt,
    deletePinHash: hashPin(deletePin, salt),
    unlockPinHash: hashPin(unlockPin, salt),
    updatedAt: FieldValue.serverTimestamp(),
  });
  // ניקוי השאריות מהמודל הישן, כדי שלא יישאר קוד גלוי לקריאה.
  batch.update(orgRef, {
    deletePin: FieldValue.delete(),
    deleteUnlockPin: FieldValue.delete(),
    pinsConfigured: true,
  });
  await batch.commit();

  return { ok: true };
});

/**
 * אימות קוד המחיקה בלבד, בלי למחוק דבר — משמש לפעולות הרסניות קטנות יותר
 * בתוך הכרטיס (מחיקת פגישה) שמוגנות באותו קוד. מונה הניסיונות משותף עם
 * deleteLeadSecure, כדי שלא יהיה אפשר "לרענן" ניסיונות דרך המסלול השני.
 */
export const verifyDeletePin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  const pin = String(request.data?.pin ?? "").trim();
  if (!orgId) throw new HttpsError("invalid-argument", "חסר מזהה ארגון.");

  const uid = request.auth.uid;
  const memberSnap = await db().collection("organizations").doc(orgId).collection("members").doc(uid).get();
  if (!memberSnap.exists) {
    throw new HttpsError("permission-denied", "אינך חבר בארגון זה.");
  }

  const orgRef = db().collection("organizations").doc(orgId);
  const attemptsRef = orgRef.collection("private").doc(`deleteAttempts_${uid}`);
  const [securitySnap, orgSnap, attemptsSnap] = await Promise.all([
    orgRef.collection("private").doc("security").get(),
    orgRef.get(),
    attemptsRef.get(),
  ]);

  if (Number(attemptsSnap.data()?.failed ?? 0) >= MAX_ATTEMPTS) {
    throw new HttpsError("permission-denied", "הפעולה נעולה — נדרש קוד שחרור נעילה.");
  }

  const ok = securitySnap.exists
    ? pinMatches(pin, securitySnap.data()!.salt, securitySnap.data()!.deletePinHash)
    : pin !== "" && pin === String(orgSnap.data()?.deletePin ?? "");

  if (!ok) {
    const nextFailed = Number(attemptsSnap.data()?.failed ?? 0) + 1;
    await attemptsRef.set({ failed: nextFailed, updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError("permission-denied", "קוד שגוי");
  }

  await attemptsRef.set({ failed: 0, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

/**
 * מחיקת כרטיס אירוע: admin בלבד, עם אימות PIN בשרת ומונה ניסיונות בשרת.
 *
 * קודם ההשוואה כולה רצה בדפדפן (`input === deletePin`) — כלומר גם הקוד וגם
 * מנגנון 3 הניסיונות היו נתונים לשליטת הלקוח, ואפשר היה לעקוף אותם לגמרי.
 */
export const deleteLeadSecure = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  const leadId = String(request.data?.leadId ?? "").trim();
  const pin = String(request.data?.pin ?? "").trim();
  const unlockPin = String(request.data?.unlockPin ?? "").trim();

  if (!orgId || !leadId) throw new HttpsError("invalid-argument", "חסרים פרטי הכרטיס.");

  const uid = request.auth.uid;
  await requireOrgAdmin(orgId, uid);

  const orgRef = db().collection("organizations").doc(orgId);
  const securityRef = orgRef.collection("private").doc("security");
  const attemptsRef = orgRef.collection("private").doc(`deleteAttempts_${uid}`);

  const [securitySnap, orgSnap, attemptsSnap] = await Promise.all([
    securityRef.get(),
    orgRef.get(),
    attemptsRef.get(),
  ]);

  // תאימות לאחור: ארגונים שעדיין לא עברו ל-private/security ממשיכים לעבוד
  // מול הקוד הישן, עד ששמירה ראשונה בהגדרות תמיר אותם.
  const legacyDeletePin = String(orgSnap.data()?.deletePin ?? "");
  const legacyUnlockPin = String(orgSnap.data()?.deleteUnlockPin ?? "");
  const hasHashed = securitySnap.exists;

  const failed = Number(attemptsSnap.data()?.failed ?? 0);
  const locked = failed >= MAX_ATTEMPTS;

  if (locked) {
    const unlockOk = hasHashed
      ? pinMatches(unlockPin, securitySnap.data()!.salt, securitySnap.data()!.unlockPinHash)
      : unlockPin !== "" && unlockPin === legacyUnlockPin;
    if (!unlockOk) {
      throw new HttpsError("permission-denied", "המחיקה נעולה — נדרש קוד שחרור נעילה תקין.");
    }
    await attemptsRef.set({ failed: 0, updatedAt: FieldValue.serverTimestamp() });
    return { unlocked: true, deleted: false, attemptsLeft: MAX_ATTEMPTS };
  }

  const pinOk = hasHashed
    ? pinMatches(pin, securitySnap.data()!.salt, securitySnap.data()!.deletePinHash)
    : pin !== "" && pin === legacyDeletePin;

  if (!pinOk) {
    const nextFailed = failed + 1;
    await attemptsRef.set({ failed: nextFailed, updatedAt: FieldValue.serverTimestamp() });
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - nextFailed);
    throw new HttpsError(
      "permission-denied",
      attemptsLeft > 0 ? `קוד שגוי — נותרו ${attemptsLeft} ניסיונות` : "המחיקה ננעלה — נדרש קוד שחרור נעילה"
    );
  }

  const batch = db().batch();
  batch.delete(orgRef.collection("leads").doc(leadId));
  batch.set(attemptsRef, { failed: 0, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();

  return { deleted: true, attemptsLeft: MAX_ATTEMPTS };
});
