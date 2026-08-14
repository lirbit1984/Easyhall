"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import {
  AlertTriangle,
  CalendarPlus,
  ChevronDown,
  CircleCheck,
  FileDown,
  Loader2,
  PlugZap,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { db, functions, isFirebaseConfigured } from "@/lib/firebase/client";
import { useOrg } from "@/lib/firebase/org-context";

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  spin,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  spin?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-sm hover:bg-muted disabled:opacity-50",
        destructive && "text-destructive hover:bg-destructive/10"
      )}
    >
      <Icon className={cn("size-4 shrink-0", spin && "animate-spin")} />
      {label}
    </button>
  );
}

/**
 * חיבור/ניתוק אישי של Google Calendar — כל משתמש מחליט בעצמו אם ברצונו
 * שיומן האולם ישתקף גם ביומן ה-Google האישי שלו. הסטטוס נקרא משדה
 * googleCalendarConnected על מסמך החברות שלו (members/{uid}), שנכתב רק
 * ע"י ה-Cloud Functions (google-calendar.ts) אחרי אישור OAuth בפועל.
 * מוצג בסרגל היומן ככפתור יחיד בסגנון "מקרא" שפותח דרופדאון עם כל הפעולות.
 */
export function GoogleCalendarConnect({ onExportClick }: { onExportClick: () => void }) {
  const { currentOrgId, user } = useOrg();
  const userId = user?.uid ?? null;
  const [connected, setConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

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

  const handleResync = async () => {
    if (!currentOrgId || !functions) return;
    setResyncing(true);
    try {
      const resyncGoogleCalendar = httpsCallable(functions, "resyncGoogleCalendar");
      await resyncGoogleCalendar({ orgId: currentOrgId });
      toast.success("היומן רוענן — כל האירועים נבנו מחדש מול Google Calendar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה ברענון");
    } finally {
      setResyncing(false);
    }
  };

  // כלי תחזוקה חד-פעמי: מנקה calendarEvents/tasks יתומים (lead_id שכבר לא
  // קיים) שנשארו מלפני שנוספה מחיקה מדורגת ל-deleteLeadSecure. יוסר אחרי
  // שהניקוי הראשוני ירוץ אצל המשתמש.
  const handleCleanupOrphans = async () => {
    if (!currentOrgId || !functions) return;
    setCleaningUp(true);
    try {
      const cleanupOrphanedRecords = httpsCallable<
        { orgId: string },
        { deletedCalendarEvents: number; deletedTasks: number }
      >(functions, "cleanupOrphanedRecords");
      const result = await cleanupOrphanedRecords({ orgId: currentOrgId });
      toast.success(
        `נוקו ${result.data.deletedCalendarEvents} רשומות יומן ו-${result.data.deletedTasks} מטלות יתומות`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בניקוי");
    } finally {
      setCleaningUp(false);
    }
  };

  if (!isFirebaseConfigured) return null;

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5">
              <ChevronDown className="size-3.5" />
              Google Calendar
            </Button>
          }
        />
        <PopoverContent align="end" className="w-56">
          <div className="flex flex-col gap-0.5">
            {connected ? (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-green-600">
                <CircleCheck className="size-4 shrink-0" />
                מחובר ל-Google Calendar
              </div>
            ) : (
              <MenuItem
                icon={loading ? Loader2 : CalendarPlus}
                spin={loading}
                label="חבר Google Calendar"
                disabled={loading}
                onClick={handleConnect}
              />
            )}

            {connected && (
              <>
                <div className="h-px bg-border" />
                <MenuItem
                  icon={resyncing ? Loader2 : RefreshCw}
                  spin={resyncing}
                  label="רענון מלא"
                  disabled={resyncing}
                  onClick={handleResync}
                />
                <MenuItem
                  icon={cleaningUp ? Loader2 : Trash2}
                  spin={cleaningUp}
                  label="ניקוי רשומות יתומות"
                  disabled={cleaningUp}
                  onClick={handleCleanupOrphans}
                />
              </>
            )}

            <div className="h-px bg-border" />
            <MenuItem
              icon={FileDown}
              label="ייצוא"
              onClick={() => {
                setMenuOpen(false);
                onExportClick();
              }}
            />

            {connected && (
              <>
                <div className="h-px bg-border" />
                <MenuItem
                  icon={PlugZap}
                  label="נתק"
                  destructive
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDisconnect(true);
                  }}
                />
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              לנתק את Google Calendar?
            </AlertDialogTitle>
            <AlertDialogDescription>
              כל האירועים שסונכרנו ליומן הגוגל האישי שלך יימחקו משם, ואירועים עתידיים לא ימשיכו להסתנכרן אליו —
              עד שתתחבר מחדש.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDisconnect(false);
                handleDisconnect();
              }}
            >
              נתק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
