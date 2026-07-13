"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  type AuthCredential,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseNotConfigured } from "@/components/auth/firebase-not-configured";

/** תרגום קודי השגיאה של Firebase Auth להודעות ברורות בעברית. */
function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "האימייל או הסיסמה שגויים. שים לב: מתחברים עם כתובת אימייל מלאה, לא שם משתמש.";
    case "auth/invalid-email":
      return "כתובת האימייל לא תקינה — יש להזין כתובת מלאה (לדוגמה name@gmail.com).";
    case "auth/too-many-requests":
      return "יותר מדי ניסיונות — נסו שוב בעוד כמה דקות או אפסו סיסמה.";
    case "auth/email-already-in-use":
      return "כבר קיים חשבון עם האימייל הזה — נסו להתחבר או לאפס סיסמה.";
    case "auth/weak-password":
      return "הסיסמה חלשה מדי — לפחות 6 תווים.";
    case "auth/network-request-failed":
      return "בעיית רשת — בדקו את החיבור לאינטרנט ונסו שוב.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    default:
      return err instanceof Error ? err.message : "שגיאה בהתחברות";
  }
}

export default function LoginPage() {
  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }
  return <LoginForm />;
}

function LoginForm() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // כשמישהו כבר נרשם עם אימייל+סיסמה ואז לוחץ Google עם אותו אימייל, Firebase
  // חוסם אוטומטית שני חשבונות נפרדים על אותו מייל (הגנה נגד השתלטות). כדי
  // "לחבר בשקיפות" בלי לוותר על ההגנה הזו, מבקשים פעם אחת את הסיסמה הקיימת,
  // ואז מקשרים את פרטי ה-Google לאותו משתמש — מכאן והלאה שתי הדרכים מובילות לאותו חשבון.
  const [linking, setLinking] = useState<{
    email: string;
    credential: AuthCredential;
  } | null>(null);
  const [linkPassword, setLinkPassword] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth!, email, password);
        router.push("/");
      } else {
        const { user } = await createUserWithEmailAndPassword(auth!, email, password);
        await sendEmailVerification(user);
        toast.success("החשבון נוצר — נשלח מייל אימות");
        router.push("/verify-email");
      }
    } catch (err) {
      const msg = authErrorMessage(err);
      if (msg) toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth!, new GoogleAuthProvider());
      router.push("/");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/account-exists-with-different-credential") {
        const credential = GoogleAuthProvider.credentialFromError(err as never);
        const collidingEmail = (err as { customData?: { email?: string } }).customData?.email ?? "";
        const methods = collidingEmail
          ? await fetchSignInMethodsForEmail(auth!, collidingEmail)
          : [];
        if (credential && collidingEmail && methods.includes("password")) {
          setLinking({ email: collidingEmail, credential });
        } else {
          toast.error("כבר קיים חשבון עם האימייל הזה בדרך התחברות אחרת.");
        }
        return;
      }
      const msg = authErrorMessage(err);
      if (msg) toast.error(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleConfirmLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linking) return;
    setLinkLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth!, linking.email, linkPassword);
      await linkWithCredential(user, linking.credential);
      toast.success("החשבונות חוברו בהצלחה — מעכשיו אפשר להתחבר גם עם Google");
      setLinking(null);
      router.push("/");
    } catch (err) {
      toast.error(authErrorMessage(err) || "שגיאה בחיבור החשבונות");
    } finally {
      setLinkLoading(false);
    }
  };

  if (linking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
        <Card className="w-full max-w-sm p-6">
          <div className="mb-5 text-center">
            <h1 className="text-lg font-semibold">חיבור חשבונות</h1>
            <p className="text-sm text-muted-foreground">
              כבר יש חשבון עם האימייל{" "}
              <span dir="ltr" className="font-medium text-foreground">
                {linking.email}
              </span>
              . הזינו את הסיסמה הקיימת כדי לחבר את Google אליו — מכאן והלאה שתי הדרכים יובילו לאותו חשבון.
            </p>
          </div>
          <form onSubmit={handleConfirmLink} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="link_password">סיסמה קיימת</Label>
              <Input
                id="link_password"
                type="password"
                dir="ltr"
                required
                autoFocus
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={linkLoading} className="mt-1">
              {linkLoading ? "מחבר..." : "חבר חשבונות"}
            </Button>
            <button
              type="button"
              className="text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setLinking(null)}
            >
              ביטול — חזרה להתחברות
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            EH
          </div>
          <h1 className="text-lg font-semibold">EasyHall CRM</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "התחברות לחשבון" : "יצירת חשבון חדש"}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mb-4 w-full gap-2"
          disabled={googleLoading}
          onClick={handleGoogleSignIn}
        >
          <GoogleIcon className="size-4" />
          {googleLoading ? "רגע..." : "המשך עם Google"}
        </Button>

        <div className="mb-4 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">או עם אימייל</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              required
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">סיסמה</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "רגע..." : mode === "signin" ? "התחבר" : "צור חשבון"}
          </Button>
        </form>

        {mode === "signin" && (
          <Link
            href="/forgot-password"
            className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            שכחת סיסמה?
          </Link>
        )}

        <button
          className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "אין לך חשבון? הרשמה" : "כבר יש לך חשבון? התחברות"}
        </button>
      </Card>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.27-2.09 3.57-5.17 3.57-8.84Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.27v3.11C3.25 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.6H1.27C.46 8.24 0 10.06 0 12s.46 3.76 1.27 5.4l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.59 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.01 3.11c.95-2.83 3.6-4.94 6.72-4.94Z"
      />
    </svg>
  );
}
