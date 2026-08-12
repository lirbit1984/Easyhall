"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./client";
import { useOrg } from "./org-context";
import { MOCK_USERS } from "@/lib/mock-data";
import type { MemberPermissions, OrgRole } from "./types";

export interface OrgMemberRow {
  user_id: string;
  full_name: string;
  role: OrgRole;
  avatar_color?: string;
  is_active: boolean;
  status: "pending" | "active";
  permissions?: MemberPermissions;
}

const DEMO_MEMBERS: OrgMemberRow[] = MOCK_USERS.map((u) => ({
  user_id: u.user_id,
  full_name: u.full_name,
  role: u.role,
  avatar_color: u.avatar_color,
  is_active: u.is_active,
  status: "active",
}));

interface OrgMembersState {
  members: OrgMemberRow[];
  loading: boolean;
  subscribedOrgId: string | null;
  unsubscribe: Unsubscribe | null;
  ensureSubscription: (orgId: string | null) => void;
}

// Module-level singleton: every component calling useOrgMembers() shares this
// one Firestore listener per org, instead of each mounting its own (a kanban
// board can render dozens of RepAvatar instances at once).
const useOrgMembersStore = create<OrgMembersState>((set, get) => ({
  members: DEMO_MEMBERS,
  loading: isFirebaseConfigured,
  subscribedOrgId: null,
  unsubscribe: null,

  ensureSubscription: (orgId) => {
    const { subscribedOrgId, unsubscribe } = get();
    if (subscribedOrgId === orgId) return;

    unsubscribe?.();

    if (!isFirebaseConfigured || !db || !orgId) {
      set({ subscribedOrgId: orgId, unsubscribe: null, members: DEMO_MEMBERS, loading: false });
      return;
    }

    const unsub = onSnapshot(
      collection(db, "organizations", orgId, "members"),
      (snap) => {
        set({
          members: snap.docs.map((d) => {
            const data = d.data();
            return {
              user_id: d.id,
              full_name: data.fullName,
              role: data.role,
              avatar_color: data.avatarColor,
              is_active: data.isActive ?? true,
              status: data.status ?? "active",
              permissions: data.permissions as MemberPermissions | undefined,
            };
          }),
          loading: false,
        });
      },
      () => set({ loading: false })
    );

    set({ subscribedOrgId: orgId, unsubscribe: unsub });
  },
}));

/** Real org roster when Firebase is connected, falls back to the demo roster otherwise. */
export function useOrgMembers() {
  const { currentOrgId } = useOrg();
  const members = useOrgMembersStore((s) => s.members);
  const loading = useOrgMembersStore((s) => s.loading);
  const ensureSubscription = useOrgMembersStore((s) => s.ensureSubscription);

  useEffect(() => {
    ensureSubscription(currentOrgId);
  }, [currentOrgId, ensureSubscription]);

  return { members, loading };
}
