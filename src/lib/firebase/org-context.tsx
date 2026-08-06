"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./client";
import type { OrgMembership, UserProfile } from "./types";

interface OrgContextValue {
  user: User | null;
  profile: UserProfile | null;
  memberships: OrgMembership[];
  currentOrgId: string | null;
  setCurrentOrgId: (orgId: string) => void;
  loading: boolean;
  refreshMemberships: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  user: null,
  profile: null,
  memberships: [],
  currentOrgId: null,
  setCurrentOrgId: () => {},
  loading: true,
  refreshMemberships: async () => {},
  refreshProfile: async () => {},
});

// A single userOrgs/{uid} doc lists every org a user belongs to. Reading this
// one document is far simpler (and needs no Firestore composite/collection-group
// index) than querying across organizations/*/members via collectionGroup.
async function fetchMemberships(userId: string): Promise<OrgMembership[]> {
  if (!db) return [];
  const snap = await getDoc(doc(db, "userOrgs", userId));
  if (!snap.exists()) return [];
  return (snap.data().orgs as OrgMembership[]) ?? [];
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setMemberships([]);
        setCurrentOrgIdState(null);
        setLoading(false);
        return;
      }

      // This callback can fire again for an already-signed-in user (e.g. right
      // after linkWithCredential during account linking). Re-arm loading so
      // AuthGuard shows the spinner for the refetch instead of briefly seeing
      // the stale (possibly null) profile from before this event and bouncing
      // to /profile-setup.
      setLoading(true);

      try {
        const [foundProfile, found] = await Promise.all([
          fetchProfile(nextUser.uid),
          fetchMemberships(nextUser.uid),
        ]);
        setProfile(foundProfile);
        setMemberships(found);
        // Keep the previously-selected org only if this user is still a member of
        // it — otherwise a stale orgId from a different account's session (same
        // tab, no full reload) would leak into this user's Firestore subscriptions.
        setCurrentOrgIdState((prev) =>
          prev && found.some((m) => m.orgId === prev) ? prev : (found[0]?.orgId ?? null)
        );
      } catch (err) {
        console.error("[OrgProvider] failed to load profile/memberships", err);
        setProfile(null);
        setMemberships([]);
        setCurrentOrgIdState(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  // Called after the onboarding flow creates/joins an org, so the guard sees
  // the new membership immediately instead of waiting for the next auth event.
  const refreshMemberships = useCallback(async () => {
    if (!auth?.currentUser) return;
    try {
      const found = await fetchMemberships(auth.currentUser.uid);
      setMemberships(found);
      setCurrentOrgIdState((prev) =>
        prev && found.some((m) => m.orgId === prev) ? prev : (found[0]?.orgId ?? null)
      );
    } catch (err) {
      console.error("[OrgProvider] failed to refresh memberships", err);
    }
  }, []);

  // Called after /profile-setup saves the profile doc, so the guard advances
  // to onboarding immediately instead of waiting for the next auth event.
  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) return;
    try {
      setProfile(await fetchProfile(auth.currentUser.uid));
    } catch (err) {
      console.error("[OrgProvider] failed to refresh profile", err);
    }
  }, []);

  const setCurrentOrgId = (orgId: string) => {
    setCurrentOrgIdState(orgId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("easyhall_current_org", orgId);
    }
  };

  return (
    <OrgContext.Provider
      value={{
        user,
        profile,
        memberships,
        currentOrgId,
        setCurrentOrgId,
        loading,
        refreshMemberships,
        refreshProfile,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
