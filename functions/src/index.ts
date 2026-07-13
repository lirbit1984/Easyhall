import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

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
 * Creates a brand-new organization with the calling user as its first admin.
 * Runs with the Admin SDK (server-side), so it is the single source of truth
 * for "the org creator is admin" — no client-writable path exists for this.
 */
export const createOrganization = onCall(async (request) => {
  const auth = requireVerifiedUser(request.auth);
  const orgName = String(request.data?.orgName ?? "").trim();
  const fullName = String(request.data?.fullName ?? "").trim();

  if (!orgName || !fullName) {
    throw new HttpsError("invalid-argument", "שם האולם ושם מלא הם שדות חובה.");
  }

  const orgRef = db.collection("organizations").doc();
  const batch = db.batch();

  batch.set(orgRef, { name: orgName, createdAt: FieldValue.serverTimestamp() });
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
  const fullName = String(request.data?.fullName ?? "").trim();

  if (!code || !fullName) {
    throw new HttpsError("invalid-argument", "קוד הזמנה ושם מלא הם שדות חובה.");
  }

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
