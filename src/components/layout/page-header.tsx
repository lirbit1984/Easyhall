import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-5 sm:mb-6", className)}>
      <div>
        <h1 className="text-2xl uppercase tracking-[.02em] sm:text-[28px]">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-[15.75px] tracking-[.08em] text-accent-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
