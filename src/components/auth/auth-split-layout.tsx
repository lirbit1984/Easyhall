import Image from "next/image";

/**
 * פריסת ה-split screen של מסכי האימות: פאנל כהה שיווקי מימין (מוסתר במובייל)
 * וטופס בפאנל בהיר. לפי 2d-login.html.
 */
export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" dir="rtl">
      {/* פאנל כהה — מוסתר במסכים צרים, שם הטופס לוקח את כל הרוחב */}
      <div className="relative hidden flex-1 flex-col justify-center bg-sidebar p-[60px] text-white lg:flex">
        <div className="mb-10 flex items-center gap-3">
          <Image src="/logo.svg" alt="" width={40} height={26} />
          <span className="font-heading text-[26px] font-semibold">EasyHall</span>
        </div>
        <h2 className="mb-4 max-w-[380px] text-[32px] leading-[1.25]">
          ניהול המכירות של האולם שלך - במקום אחד
        </h2>
        <p className="max-w-[340px] text-sm leading-relaxed text-white/70">
          לידים, יומן, משימות ודוחות לכל צוות המכירות שלך.
        </p>
      </div>

      {/* פאנל הטופס */}
      <div className="flex w-full flex-none flex-col justify-center bg-background p-8 sm:p-[60px] lg:w-[440px]">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <h1 className="mb-1.5 text-[26px]">{title}</h1>
      {subtitle && <p className="text-[13px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
