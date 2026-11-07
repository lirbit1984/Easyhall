import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enforceRateLimit, callerIp } from "./rate-limit";

const db = () => getFirestore();

/**
 * חתימת זוג על חוזה מתוך /sign/{token}.
 *
 * הזוג לא מחובר, ולכן הכתיבה עוברת כאן דרך Admin SDK ולא נפתח שום נתיב כתיבה
 * ציבורי ב-Firestore: מאמתים שהטוקן קיים ועדיין ממתין, שומרים את החתימה על
 * בקשת החתימה, ומסמנים בכרטיס האירוע "חוזה נחתם" + מסמך + פעילות.
 */
export const signContract = onCall(async (request) => {
  await enforceRateLimit({
    key: `signContract:${callerIp(request.rawRequest)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
    message: "יותר מדי ניסיונות — נסו שוב בעוד שעה.",
  });

  const token = String(request.data?.token ?? "").trim();
  const name = String(request.data?.name ?? "").trim().slice(0, 120);
  const idNumber = String(request.data?.id_number ?? "").replace(/\D/g, "").slice(0, 9);
  const signature = String(request.data?.signature ?? "");

  if (!/^[a-z0-9]{16}$/.test(token)) throw new HttpsError("invalid-argument", "הקישור לא תקין.");
  if (!name) throw new HttpsError("invalid-argument", "יש להזין שם מלא.");
  if (!idNumber) throw new HttpsError("invalid-argument", "יש להזין תעודת זהות.");
  // PNG מה-canvas; תקרה כדי שמסמך Firestore לא יעבור את המגבלה (1MB)
  if (!signature.startsWith("data:image/png;base64,") || signature.length > 300_000) {
    throw new HttpsError("invalid-argument", "החתימה לא תקינה.");
  }

  const reqRef = db().collection("signRequests").doc(token);
  const signedAt = new Date().toISOString();

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError("not-found", "הקישור לא נמצא.");
    const req = snap.data()!;
    if (req.status !== "pending") throw new HttpsError("failed-precondition", "החוזה כבר נחתם.");

    const leadRef = db().collection("organizations").doc(req.orgId).collection("leads").doc(req.leadId);
    const leadSnap = await tx.get(leadRef);
    if (!leadSnap.exists) throw new HttpsError("not-found", "האירוע לא נמצא.");
    const lead = leadSnap.data()!;

    tx.update(reqRef, { status: "signed", signed: { name, id_number: idNumber, signature, signed_at: signedAt } });

    const prev: { key: string; label?: string; done?: boolean }[] = lead.milestones ?? [];
    const milestones = prev.some((m) => m.key === "contract_signed")
      ? prev.map((m) => (m.key === "contract_signed" ? { ...m, done: true } : m))
      : [...prev, { key: "contract_signed", label: "חוזה נחתם", done: true }];
    const documents = [...(lead.documents ?? []), {
      doc_id: `signed_${token}`,
      name: `חוזה חתום - ${name}`,
      type: "contract",
      url: `/sign/${token}`,
      created_at: signedAt,
    }];
    tx.update(leadRef, {
      milestones, documents,
      ...(!lead.event_date && req.eventDate ? { event_date: req.eventDate } : {}),
    });

    const actRef = db().collection("organizations").doc(req.orgId).collection("activity").doc();
    tx.set(actRef, {
      activity_id: actRef.id,
      lead_id: req.leadId,
      user_id: "",
      activity_type: "note",
      content: `${name} חתם/ה על החוזה דיגיטלית.`,
      created_at: signedAt,
      is_system: true,
    });
  });

  return { ok: true };
});
