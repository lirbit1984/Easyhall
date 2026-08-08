import Link from "next/link";
import { XCircle } from "lucide-react";

export const metadata = {
  title: "התשלום בוטל — EasyHall",
};

/**
 * דף נחיתה ציבורי אחרי ביטול/כישלון תשלום ב-Grow. אין כאן שום שינוי במצב
 * הליד — קישור התשלום נשאר תקף, כך שאפשר פשוט לנסות שוב.
 */
export default function PaymentCancelledPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4" dir="rtl">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-8 text-center">
        <XCircle className="mx-auto mb-4 size-10 text-muted-foreground" strokeWidth={1.5} />
        <h1 className="mb-2 text-lg font-semibold">התשלום לא הושלם</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          לא בוצע חיוב. אפשר לנסות שוב דרך אותו קישור תשלום שקיבלתם, או לפנות
          לאולם לכל שאלה.
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
