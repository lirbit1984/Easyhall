import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

export { setPaymentCredentials, createPaymentLink, growWebhook } from "./payments";

/** אורך תקופת הניסיון לאולם חדש, בימים. */
const TRIAL_DAYS = 14;

type OrgRole = "admin" | "sales_rep" | "office";

function requireVerifiedUser(auth: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  if (!auth.token.email_verified) {
    throw new HttpsError("failed-precondition", "יש לאמת את כתובת האימייל לפני יצירת/הצטרפות לארגון.");
  }
  return auth;
}

/**
 * שם התצוגה של המשתמש נלקח תמיד מפרופיל השרת (users/{uid}, שנוצר במסך
 * /profile-setup) ולא מגוף הבקשה — כך שאין דרך ללקוח "להתחזות" בשם אחר בזמן
 * יצירת/הצטרפות לארגון, וכל התיעוד עקבי עם הפרופיל האמיתי של האדם.
 */
async function requireProfileFullName(uid: string): Promise<string> {
  const snap = await db.collection("users").doc(uid).get();
  const fullName = String(snap.data()?.fullName ?? "").trim();
  if (!fullName) {
    throw new HttpsError("failed-precondition", "יש להשלים פרופיל אישי (שם מלא) לפני המשך.");
  }
  return fullName;
}

/**
 * Creates a brand-new organization with the calling user as its first admin.
 * Runs with the Admin SDK (server-side), so it is the single source of truth
 * for "the org creator is admin" — no client-writable path exists for this.
 */
export const createOrganization = onCall(async (request) => {
  const auth = requireVerifiedUser(request.auth);
  const orgName = String(request.data?.orgName ?? "").trim();

  if (!orgName) {
    throw new HttpsError("invalid-argument", "שם האולם הוא שדה חובה.");
  }
  const fullName = await requireProfileFullName(auth.uid);

  const orgRef = db.collection("organizations").doc();
  const batch = db.batch();

  batch.set(orgRef, {
    name: orgName,
    createdAt: FieldValue.serverTimestamp(),
    // מודל המנוי של EasyHall עצמו: אולם חדש מתחיל בתקופת ניסיון.
    // חיוב אמיתי (הוראת קבע Grow) יחובר כשיוגדר חשבון הסליקה של EasyHall;
    // ארגונים ותיקים בלי השדה הזה נחשבים active (grandfathered).
    subscription: {
      plan: "trial",
      status: "trialing",
      trialEndsAt: Timestamp.fromDate(new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)),
    },
  });
  batch.set(orgRef.collection("members").doc(auth.uid), {
    userId: auth.uid,
    fullName,
    orgName,
    role: "admin" satisfies OrgRole,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    db.collection("userOrgs").doc(auth.uid),
    { orgs: FieldValue.arrayUnion({ orgId: orgRef.id, orgName, role: "admin", fullName }) },
    { merge: true }
  );

  await batch.commit();
  return { orgId: orgRef.id, orgName };
});

/**
 * Redeems an invite code: validates it server-side (expiry, existence) and
 * assigns exactly the role the invite specifies — the client never gets to
 * choose its own role here, closing the "self-assign admin" gap that existed
 * when membership docs were written directly from the browser.
 */
export const redeemInvite = onCall(async (request) => {
  const auth = requireVerifiedUser(request.auth);
  const code = String(request.data?.code ?? "").trim();

  if (!code) {
    throw new HttpsError("invalid-argument", "קוד הזמנה הוא שדה חובה.");
  }
  const fullName = await requireProfileFullName(auth.uid);

  const inviteRef = db.collection("invites").doc(code);
  const inviteSnap = await inviteRef.get();

  if (!inviteSnap.exists) {
    throw new HttpsError("not-found", "קוד ההזמנה לא נמצא.");
  }

  const invite = inviteSnap.data() as {
    orgId: string;
    orgName: string;
    role: OrgRole;
    expiresAt?: FirebaseFirestore.Timestamp;
  };

  if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
    throw new HttpsError("failed-precondition", "קוד ההזמנה פג תוקף.");
  }

  const memberRef = db
    .collection("organizations")
    .doc(invite.orgId)
    .collection("members")
    .doc(auth.uid);

  const batch = db.batch();
  batch.set(memberRef, {
    userId: auth.uid,
    fullName,
    orgName: invite.orgName,
    role: invite.role,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(
    db.collection("userOrgs").doc(auth.uid),
    {
      orgs: FieldValue.arrayUnion({
        orgId: invite.orgId,
        orgName: invite.orgName,
        role: invite.role,
        fullName,
      }),
    },
    { merge: true }
  );
  // Single-use invite.
  batch.delete(inviteRef);

  await batch.commit();
  return { orgId: invite.orgId, orgName: invite.orgName, role: invite.role };
});
