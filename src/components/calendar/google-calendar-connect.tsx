"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { CalendarCheck2, CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";

/**
 * חיבור/ניתוק אישי של Google Calendar — כל משתמש מחליט בעצמו אם ברצונו
 * שיומן האולם ישתקף גם ביומן ה-Google האישי שלו. הסטטוס נקרא משדה
 * googleCalendarConnected על מסמך החברות שלו (members/{uid}), שנכתב רק
 * ע"י ה-Cloud Functions (google-calendar.ts) אחרי אישור OAuth בפועל.
 */
export function GoogleCalendarConnect() {
  const { currentOrgId, user } = useOrg();
  const userId = user?.uid ?? null;
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !currentOrgId || !userId) return;
    return onSnapshot(doc(db, "organizations", currentOrgId, "members", userId), (snap) => {
      setConnected(Boolean(snap.data()?.googleCalendarConnected));
    });
  }, [currentOrgId, userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google");
    if (!status) return;
    if (status === "connected") toast.success("Google Calendar חובר בהצלחה");
    if (status === "error") toast.error("החיבור ל-Google Calendar נכשל, נסה שוב");
    params.delete("google");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, []);

  const handleConnect = async () => {
    if (!currentOrgId || !functions) return;
    setLoading(true);
    try {
      const getGoogleAuthUrl = httpsCallable<{ orgId: string }, { url: string }>(functions, "getGoogleAuthUrl");
      const result = await getGoogleAuthUrl({ orgId: currentOrgId });
      window.location.href = result.data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בפתיחת חיבור Google");
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentOrgId || !functions) return;
    setLoading(true);
    try {
      const disconnectGoogleCalendar = httpsCallable(functions, "disconnectGoogleCalendar");
      await disconnectGoogleCalendar({ orgId: currentOrgId });
      toast.success("Google Calendar נותק");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בניתוק");
    } finally {
      setLoading(false);
    }
  };

  if (!isFirebaseConfigured) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={connected ? handleDisconnect : handleConnect}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : connected ? (
        <CalendarCheck2 className="size-3.5 text-green-600" />
      ) : (
        <CalendarPlus className="size-3.5" />
      )}
      {connected ? "מחובר ל-Google Calendar" : "חבר Google Calendar"}
    </Button>
  );
}
