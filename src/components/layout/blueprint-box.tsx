import { cn } from "@/lib/utils";

/**
 * Aurora surface — cream/white gradient card with a soft brand-color glow
 * and rounded corners. Replaces the old Industry "blueprint" hairline+corner
 * treatment; kept the same name/API so every screen using it picks up the
 * new look automatically.
 */
export function BlueprintBox({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("aurora-card relative p-[18px]", className)} {...props}>
      <span className="aurora-glow" aria-hidden="true" />
      {children}
    </div>
  );
}

export function BoxKicker({ className, children }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-2.5 text-[12px] uppercase tracking-[.14em] text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
