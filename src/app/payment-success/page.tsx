import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "התשלום התקבל — EasyHall",
};

/**
 * דף נחיתה ציבורי אחרי תשלום מוצלח ב-Grow. הזוג אינו משתמש במערכת ולכן
 * הדף יושב מחוץ ל-(app) ואינו דורש התחברות. סימון המקדמה כשולמה קורה
 * בשרת דרך growWebhook, לא כאן — הדף הזה הוא אישור לעין בלבד.
 */
export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 size-10 text-emerald-600" strokeWidth={1.5} />
        <h1 className="mb-2 text-lg font-semibold">התשלום התקבל בהצלחה</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          תודה! האולם קיבל אישור על התשלום ויחזור אליכם עם המשך הפרטים. אפשר לסגור
          את החלון הזה.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-accent-foreground underline-offset-4 hover:underline"
        >
          חזרה לאתר
        </Link>
      </div>
    </main>
  );
}
