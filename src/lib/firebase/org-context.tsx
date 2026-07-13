"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./client";
import type { OrgMembership } from "./types";

interface OrgContextValue {
  user: User | null;
  memberships: OrgMembership[];
  currentOrgId: string | null;
  setCurrentOrgId: (orgId: string) => void;
  loading: boolean;
  refreshMemberships: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  user: null,
  memberships: [],
  currentOrgId: null,
  setCurrentOrgId: () => {},
  loading: true,
  refreshMemberships: async () => {},
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

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setMemberships([]);
        setCurrentOrgIdState(null);
        setLoading(false);
        return;
      }

      try {
        const found = await fetchMemberships(nextUser.uid);
        setMemberships(found);
        // Keep the previously-selected org only if this user is still a member of
        // it — otherwise a stale orgId from a different account's session (same
        // tab, no full reload) would leak into this user's Firestore subscriptions.
        setCurrentOrgIdState((prev) =>
          prev && found.some((m) => m.orgId === prev) ? prev : (found[0]?.orgId ?? null)
        );
      } catch (err) {
        console.error("[OrgProvider] failed to load memberships", err);
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

  const setCurrentOrgId = (orgId: string) => {
    setCurrentOrgIdState(orgId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("easyhall_current_org", orgId);
    }
  };

  return (
    <OrgContext.Provider
      value={{ user, memberships, currentOrgId, setCurrentOrgId, loading, refreshMemberships }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
