"use client";

import { useEffect } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useOrg } from "./org-context";
import { db, isFirebaseConfigured } from "./client";
import { useLeadsStore } from "@/store/use-leads-store";
import type { LeadEvent, ActivityFeedItem, Task, CalendarEvent, CatalogItem, TaskPreset, EventType, PromisePreset, OrgFile, OrgSupplier, PlanningPreset } from "@/lib/types";

/**
 * Mounted once inside the authenticated app shell. Bridges the current
 * Firebase session (org + user) into the zustand store, and keeps the
 * store's leads/activity/tasks/calendarEvents in sync with Firestore via
 * live listeners scoped to organizations/{orgId}. No-ops entirely in demo
 * mode (Firebase not configured), leaving the mock data store untouched.
 */
export function FirestoreSync() {
  const { user, currentOrgId, memberships } = useOrg();
  const setSession = useLeadsStore((s) => s.setSession);
  const hydrateLeads = useLeadsStore((s) => s.hydrateLeads);
  const hydrateActivity = useLeadsStore((s) => s.hydrateActivity);
  const hydrateTasks = useLeadsStore((s) => s.hydrateTasks);
  const hydrateCalendarEvents = useLeadsStore((s) => s.hydrateCalendarEvents);
  const hydrateCatalog = useLeadsStore((s) => s.hydrateCatalog);
  const hydrateTaskPresets = useLeadsStore((s) => s.hydrateTaskPresets);
  const hydrateEventTypes = useLeadsStore((s) => s.hydrateEventTypes);
  const hydratePromisePresets = useLeadsStore((s) => s.hydratePromisePresets);
  const hydrateOrgFiles = useLeadsStore((s) => s.hydrateOrgFiles);
  const hydrateOrgSuppliers = useLeadsStore((s) => s.hydrateOrgSuppliers);
  const hydratePlanningPresets = useLeadsStore((s) => s.hydratePlanningPresets);
  const hydrateSecurityPins = useLeadsStore((s) => s.hydrateSecurityPins);

  useEffect(() => {
    if (!isFirebaseConfigured || !user || !currentOrgId) return;
    const membership = memberships.find((m) => m.orgId === currentOrgId);
    setSession(currentOrgId, user.uid, membership?.fullName ?? user.email ?? "משתמש");
  }, [user, currentOrgId, memberships, setSession]);

  const role = memberships.find((m) => m.orgId === currentOrgId)?.role;

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !currentOrgId) return;

    const unsubLeads = onSnapshot(
      collection(db, "organizations", currentOrgId, "leads"),
      (snap) => {
        const all = snap.docs.map((d) => ({ ...d.data(), lead_id: d.id }) as LeadEvent);
        // מנהל אירוע עובד רק על אירועים שנסגרו. הסינון כאן, בנקודת הכניסה
        // היחידה של הלידים לסטור, כדי שכל מסך במערכת (קנבן, חיפוש, יומן,
        // דשבורד) יקבל אותו בלי סינון נפרד בכל אחד מהם.
        hydrateLeads(role === "event_manager" ? all.filter((l) => l.status === "closed") : all);
      }
    );
    const unsubActivity = onSnapshot(
      collection(db, "organizations", currentOrgId, "activity"),
      (snap) =>
        hydrateActivity(
          snap.docs
            .map((d) => ({ ...d.data(), activity_id: d.id }) as ActivityFeedItem)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        )
    );
    const unsubTasks = onSnapshot(
      collection(db, "organizations", currentOrgId, "tasks"),
      (snap) => hydrateTasks(snap.docs.map((d) => ({ ...d.data(), task_id: d.id }) as Task))
    );
    const unsubCalendar = onSnapshot(
      collection(db, "organizations", currentOrgId, "calendarEvents"),
      (snap) =>
        hydrateCalendarEvents(
          snap.docs.map((d) => ({ ...d.data(), calendar_event_id: d.id }) as CalendarEvent)
        )
    );
    const unsubCatalog = onSnapshot(
      collection(db, "organizations", currentOrgId, "catalog"),
      (snap) => hydrateCatalog(snap.docs.map((d) => ({ ...d.data(), item_id: d.id }) as CatalogItem))
    );
    const unsubTaskPresets = onSnapshot(
      collection(db, "organizations", currentOrgId, "taskPresets"),
      (snap) => hydrateTaskPresets(snap.docs.map((d) => ({ ...d.data(), preset_id: d.id }) as TaskPreset))
    );
    const unsubEventTypes = onSnapshot(
      collection(db, "organizations", currentOrgId, "eventTypes"),
      (snap) => hydrateEventTypes(snap.docs.map((d) => ({ ...d.data(), event_type_id: d.id }) as EventType))
    );
    const unsubPromisePresets = onSnapshot(
      collection(db, "organizations", currentOrgId, "promisePresets"),
      (snap) => hydratePromisePresets(snap.docs.map((d) => ({ ...d.data(), preset_id: d.id }) as PromisePreset))
    );
    const unsubOrgFiles = onSnapshot(
      collection(db, "organizations", currentOrgId, "orgFiles"),
      (snap) => hydrateOrgFiles(snap.docs.map((d) => ({ ...d.data(), file_id: d.id }) as OrgFile))
    );
    const unsubOrgSuppliers = onSnapshot(
      collection(db, "organizations", currentOrgId, "orgSuppliers"),
      (snap) => hydrateOrgSuppliers(snap.docs.map((d) => ({ ...d.data(), supplier_id: d.id }) as OrgSupplier))
    );
    const unsubPlanningPresets = onSnapshot(
      collection(db, "organizations", currentOrgId, "planningPresets"),
      (snap) => hydratePlanningPresets(snap.docs.map((d) => ({ ...d.data(), preset_id: d.id }) as PlanningPreset))
    );
    const unsubOrgDoc = onSnapshot(doc(db, "organizations", currentOrgId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      hydrateSecurityPins({ deletePin: data.deletePin, deleteUnlockPin: data.deleteUnlockPin });
    });

    return () => {
      unsubLeads();
      unsubActivity();
      unsubTasks();
      unsubCalendar();
      unsubCatalog();
      unsubTaskPresets();
      unsubEventTypes();
      unsubPromisePresets();
      unsubOrgFiles();
      unsubOrgSuppliers();
      unsubPlanningPresets();
      unsubOrgDoc();
    };
  }, [
    currentOrgId,
    role,
    hydrateLeads,
    hydrateActivity,
    hydrateTasks,
    hydrateCalendarEvents,
    hydrateCatalog,
    hydrateTaskPresets,
    hydrateEventTypes,
    hydratePromisePresets,
    hydrateOrgFiles,
    hydrateOrgSuppliers,
    hydratePlanningPresets,
    hydrateSecurityPins,
  ]);

  return null;
}
