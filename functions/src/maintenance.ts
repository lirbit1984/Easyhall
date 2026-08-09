import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = () => getFirestore();

/**
 * ניקוי חד-פעמי של רשומות "יתומות": calendarEvents/tasks עם lead_id שכבר
 * לא קיים ב-leads — שרידים מלפני שנוסף מחיקה מדורגת ל-deleteLeadSecure.
 * מחיקת calendarEvent כאן מפעילה את הטריגר הרגיל ומסירה אותו גם מ-Google
 * Calendar אצל כל מי שמחובר, בדיוק כמו כל מחיקה רגילה.
 */
export const cleanupOrphanedRecords = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "יש להתחבר כדי לבצע פעולה זו.");
  }
  const orgId = String(request.data?.orgId ?? "").trim();
  if (!orgId) {
    throw new HttpsError("invalid-argument", "orgId חסר.");
  }
  const orgRef = db().collection("organizations").doc(orgId);
  const memberSnap = await orgRef.collection("members").doc(request.auth.uid).get();
  if (!memberSnap.exists || memberSnap.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "רק מנהל יכול להריץ ניקוי.");
  }

  const [leadsSnap, calendarEventsSnap, tasksSnap] = await Promise.all([
    orgRef.collection("leads").get(),
    orgRef.collection("calendarEvents").get(),
    orgRef.collection("tasks").get(),
  ]);
  const leadIds = new Set(leadsSnap.docs.map((d) => d.id));

  const batch = db().batch();
  let deletedCalendarEvents = 0;
  let deletedTasks = 0;
  for (const d of calendarEventsSnap.docs) {
    const leadId = d.data().lead_id as string | undefined;
    if (leadId && !leadIds.has(leadId)) {
      batch.delete(d.ref);
      deletedCalendarEvents++;
    }
  }
  for (const d of tasksSnap.docs) {
    const leadId = d.data().lead_id as string | undefined;
    if (leadId && !leadIds.has(leadId)) {
      batch.delete(d.ref);
      deletedTasks++;
    }
  }
  await batch.commit();

  return { deletedCalendarEvents, deletedTasks };
});
