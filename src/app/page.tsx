import Link from "next/link";
import Image from "next/image";
import {
  TriangleAlert,
  TrendingUp,
  CalendarDays,
  ListChecks,
  Check,
  Zap,
  CalendarCheck,
  FileCheck,
} from "lucide-react";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { LandingContactForm } from "@/components/landing/landing-contact-form";

export const metadata = {
  title: "EasyHall — CRM לניהול אולמות אירועים",
  description:
    "מערכת CRM לאולמות אירועים: לידים, יומן פגישות, חוזים ותשלומים — הכל בלוח עבודה אחד.",
};

/** צילום מסך אמיתי, ממוסגר בכרטיס Aurora. כל תמונה שומרת על היחס המקורי
 * שלה (בלי חיתוך) כדי שלא ייעלם תוכן חשוב מהצילום. */
function ScreenshotSlot({
  src,
  alt,
  width,
  height,
  priority,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <BlueprintBox className={`p-1.5 sm:p-2 ${className ?? ""}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-full rounded-[10px]"
        sizes="(min-width: 1024px) 560px, 100vw"
      />
    </BlueprintBox>
  );
}

const PROBLEMS = [
  {
    icon: TriangleAlert,
    title: "לידים נופלים בין הכיסאות",
    body: "פניות חדשות מגיעות מכל מקום ולא כולן נענות בזמן.",
  },
  {
    icon: TrendingUp,
    title: "אין מעקב מדויק על ההכנסות",
    body: "קשה לדעת אילו זוגות סגרו, מה שווי הלידים ואיפה הכסף נמצא.",
  },
  {
    icon: CalendarDays,
    title: "תיאום פגישות ידני",
    body: "שיחות טלפון וואטסאפים הלוך ושוב לתיאום כל טעימה וסיור באולם.",
  },
  {
    icon: ListChecks,
    title: "ניהול בטבלאות אקסל",
    body: "כל אולם עם קובץ נפרד, בלי סנכרון בין הצוות והתשלומים.",
  },
];

const FEATURES = [
  "ניהול לידים מלא",
  "יומן פגישות וטעימות עם סנכרון צוות",
  "חוזים ותשלומים במקום אחד",
  "אפליקציה לנייד לניהול מכל מקום",
  "דוחות ותובנות בזמן אמת",
];

const STEPS = [
  { n: "01", title: "פגישת התאמה", body: "נבין את האופי של האולם שלכם, מה צריך לשפר ואיך נתאים את המערכת לצרכים שלכם." },
  { n: "02", title: "הטמעת המערכת", body: "מטמיעים את המערכת באולם — לידים, יומן, טפסים דיגיטליים לזוגות." },
  { n: "03", title: "תהליכים מתקדמים", body: "מגדירים תזכורות ותהליכי מעקב אוטומטיים לכל ליד וזוג." },
  { n: "04", title: "הדרכה לצוות", body: "מדריכים את הצוות לעומק כדי שיתפעל את המערכת בביטחון מהיום הראשון." },
  { n: "05", title: "תמיכה לטווח ארוך", body: "מלווים אתכם עם תמיכה שוטפת ומנהל לקוחות אישי." },
];

const FAQ = [
  {
    q: "האם ניתן למזג את המידע מהמערכת הקיימת שלי?",
    a: "בוודאי, נדאג לייבא לך את כל המידע הקיים למערכת החדשה מבלי לאבד מידע.",
  },
  {
    q: "אם ארצה לבטל?",
    a: "תוכלו להודיע לנו תוך חודש ולהתנתק מהמערכת תוך קבלה של כל הנתונים שלכם חזרה.",
  },
  {
    q: "האם המערכת מתאימה לכל סוגי האולמות?",
    a: "בוודאי, המערכת מותאמת לצרכים ולגודל האולם שלכם ולא להפך.",
  },
  {
    q: "האם אפשר לנהל את האולם גם מהנייד?",
    a: "כמובן — יש לנו אפליקציה ידידותית לנייד למעקב מכל מקום.",
  },
];

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] font-bold uppercase tracking-[.18em] text-[var(--color-accent-700)]">
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center gap-8 border-b border-border px-6 py-5 sm:px-[60px]">
        <Link href="/" className="flex items-center gap-2.5 text-[var(--color-accent-700)]">
          <Image src="/logo.svg" alt="" width={38} height={24} />
          <span className="font-heading text-xl font-extrabold text-foreground">EasyHall</span>
        </Link>
        <nav className="hidden gap-7 text-sm text-foreground/65 md:flex">
          <a href="#solution" className="hover:text-[var(--color-accent-700)]">הפתרון</a>
          <a href="#features" className="hover:text-[var(--color-accent-700)]">יכולות</a>
          <a href="#steps" className="hover:text-[var(--color-accent-700)]">איך זה עובד</a>
          <a href="#faq" className="hover:text-[var(--color-accent-700)]">שאלות נפוצות</a>
        </nav>
        <div className="flex flex-1 items-center justify-end gap-2.5">
          <Link
            href="/login"
            className="px-3 py-2 text-sm font-medium text-foreground hover:text-[var(--color-accent-700)]"
          >
            כניסה למערכת
          </Link>
          <a
            href="#contact"
            className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-[var(--color-accent-600)]"
          >
            דברו איתנו
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-16 sm:px-[60px] sm:py-24">
        <div className="mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <Kicker>CRM לאולמות אירועים</Kicker>
            <h1 className="mb-5 text-[38px] font-extrabold leading-[1.12] sm:text-[54px]">
              מערכת ה-CRM החדשנית ביותר{" "}
              <span className="text-[var(--color-accent-700)]">לניהול האולם שלך</span>
            </h1>
            <p className="mb-8 max-w-[480px] text-[17px] leading-[1.65] text-foreground/65">
              כל מה שהאולם שלך צריך במקום אחד — לידים, פגישות, חוזים ותשלומים, בלוח
              עבודה אחד במקום בעשרה טבלאות אקסל.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <a
                href="#contact"
                className="bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[var(--color-accent-600)]"
              >
                דברו איתנו
              </a>
              <Link
                href="/login"
                className="border border-border px-5 py-2.5 text-sm font-medium hover:bg-foreground/[.04]"
              >
                כניסה למערכת
              </Link>
            </div>
          </div>
          <ScreenshotSlot
            src="/shot-dashboard.png"
            alt="לוח הבקרה של EasyHall"
            width={807}
            height={594}
            priority
          />
        </div>
      </section>

      {/* Capabilities strip — replaces made-up stats (320+/38%/4.9) with what
          the system actually does, so nothing here needs a number to back it up. */}
      <section className="bg-sidebar text-white">
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-center gap-10 px-6 py-11 text-center sm:gap-16 sm:px-[60px]">
          {[
            { Icon: Zap, s: "כל ליד נכנס למקום אחד, בזמן אמת" },
            { Icon: CalendarCheck, s: "יומן אחד לכל האולם, בלי התנגשויות" },
            { Icon: FileCheck, s: "חוזה ותשלום, בלי לצאת מהמערכת" },
          ].map((x) => (
            <div key={x.s} className="flex max-w-[170px] flex-col items-center gap-2.5">
              <x.Icon className="size-6 text-[var(--color-accent-300)]" strokeWidth={1.75} />
              <span className="text-[13px] leading-relaxed text-white/80">{x.s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Problems */}
      <section className="px-6 py-20 sm:px-[60px] sm:py-24">
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <Kicker>מדוע היא נחוצה?</Kicker>
          <h2 className="mb-3.5 text-[36px] font-extrabold">
            בעיות נפוצות שבעלי אולמות מתמודדים איתן
          </h2>
          <p className="text-base leading-relaxed text-foreground/60">
            ההחלטה להטמיע מערכת ניהול באולם שלך מגיעה כדי לייעל את העבודה. לרוב המציאות שונה.
          </p>
        </div>
        <div className="mx-auto grid max-w-[1180px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((p) => {
            const Icon = p.icon;
            return (
              <BlueprintBox key={p.title} className="px-6 py-7">
                <Icon className="mb-4 size-9 text-primary" strokeWidth={1.5} />
                <h4 className="mb-2 text-base font-bold">{p.title}</h4>
                <p className="text-[13px] leading-relaxed text-foreground/60">{p.body}</p>
              </BlueprintBox>
            );
          })}
        </div>
      </section>

      {/* Solution rows */}
      <section id="solution">
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 py-14 sm:gap-16 sm:px-[60px] lg:grid-cols-2">
          <div>
            <Kicker>EasyHall גאים להציג בפניכם</Kicker>
            <h3 className="mb-4 text-[28px] font-extrabold">את הפתרון האידיאלי לאולם שלך</h3>
            <p className="text-[15.5px] leading-[1.7] text-foreground/60">
              מערכת אחת שמכילה בתוכה את כל מה שהאולם שלך צריך — לידים, יומן
              פגישות, חוזים ותשלומים — במקסימום איכות ומינימום מאמץ. אנחנו נשארים
              לצידך גם אחרי ההטמעה כדי להתאים את המערכת לתהליכי העבודה שלכם.
            </p>
          </div>
          <ScreenshotSlot
            src="/shot-pipeline.png"
            alt="ניהול הלידים של EasyHall"
            width={1532}
            height={617}
          />
        </div>
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 py-14 sm:gap-16 sm:px-[60px] lg:grid-cols-2">
          <ScreenshotSlot
            src="/shot-calendar.png"
            alt="יומן הפגישות של EasyHall"
            width={1623}
            height={831}
            className="lg:order-1"
          />
          <div className="lg:order-2">
            <Kicker>כל האולם במערכת אחת</Kicker>
            <h3 className="mb-4 text-[28px] font-extrabold">בלי חיבורים, בלי תוספים יקרים</h3>
            <p className="text-[15.5px] leading-[1.7] text-foreground/60">
              בכל מערכת ניהול לידים אחרת תצטרכו לשלם על חיבורים בין כלים שונים. אצלנו
              הכל בנוי מהיסוד לתוך לוח עבודה אחד — לצוות, לספקים ולזוגות.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-secondary px-6 py-20 sm:px-[60px] sm:py-24">
        <div className="mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-2">
          <ScreenshotSlot
            src="/shot-app.png"
            alt="הוספת ליד חדש במערכת EasyHall"
            width={713}
            height={633}
          />
          <div>
            <Kicker>מה כל כך מיוחד במערכת שלנו?</Kicker>
            <h3 className="mb-5 text-[28px] font-extrabold">כל היכולות שהאולם שלך צריך</h3>
            <ul className="flex flex-col gap-5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3.5 text-[15.5px] font-medium">
                  <span className="flex size-[22px] flex-none items-center justify-center border border-primary text-primary">
                    <Check className="size-3.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="steps" className="px-6 py-20 sm:px-[60px] sm:py-24">
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <Kicker>כמה צעדים קדימה?</Kicker>
          <h2 className="text-[36px] font-extrabold">איך מתקדמים מכאן</h2>
        </div>
        <div className="mx-auto flex max-w-[900px] flex-col">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="grid grid-cols-[56px_1fr] gap-6 border-b border-border py-7 last:border-b-0 sm:grid-cols-[70px_1fr]"
            >
              <div className="font-heading text-[34px] font-extrabold text-[var(--color-accent-300)]">
                {s.n}
              </div>
              <div>
                <h4 className="mb-2 text-lg font-bold">{s.title}</h4>
                <p className="text-[14.5px] leading-[1.65] text-foreground/60">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Positioning statement — no longer attributed to a specific customer
          quote we don't actually have. */}
      <section className="bg-sidebar px-6 py-24 text-center text-white sm:px-[60px]">
        <blockquote className="mx-auto max-w-[760px] text-2xl font-medium leading-[1.55]">
          &ldquo;ככה זה מרגיש לעבור מאקסל לניהול אמיתי — פחות לידים נופלים, יותר חתונות סגורות.&rdquo;
        </blockquote>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20 sm:px-[60px] sm:py-24">
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <Kicker>אתם שואלים</Kicker>
          <h2 className="text-[36px] font-extrabold">אנחנו עונים</h2>
        </div>
        <div className="mx-auto flex max-w-[760px] flex-col">
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              open={i === 0}
              className="group border-b border-border py-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-[16.5px] font-bold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="text-[22px] text-primary group-open:hidden">+</span>
                <span className="hidden text-[22px] text-primary group-open:inline">–</span>
              </summary>
              <p className="mt-3.5 text-[14.5px] leading-[1.65] text-foreground/60">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="px-6 py-20 sm:px-[60px] sm:py-24">
        <BlueprintBox className="mx-auto max-w-[560px] p-8 sm:p-11">
          <h2 className="mb-2.5 text-center text-[28px] font-extrabold">מוכנים להתחיל?</h2>
          <p className="mb-7 text-center text-[14.5px] text-foreground/60">
            השאירו פרטים ונחזור אליכם עם הדגמה מותאמת לאולם שלכם
          </p>
          <LandingContactForm />
        </BlueprintBox>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center justify-between gap-4 border-t border-border px-6 py-10 text-[13px] text-foreground/55 sm:flex-row sm:px-[60px]">
        <span className="font-heading text-base font-extrabold text-foreground">EasyHall</span>
        <div className="flex gap-[18px]">
          <a href="#" className="hover:text-[var(--color-accent-700)]">Instagram</a>
          <a href="#" className="hover:text-[var(--color-accent-700)]">WhatsApp</a>
          <a href="#" className="hover:text-[var(--color-accent-700)]">YouTube</a>
        </div>
      </footer>
    </div>
  );
}
