import { cn } from "@/lib/utils";

/**
 * Industry "blueprint" surface — square, transparent, hairline border,
 * with 4 registration-mark (+) corners. Matches the .bx / .card.blueprint
 * pattern from the design system.
 */
export function BlueprintBox({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("blueprint relative border border-border bg-card p-[18px]", className)}
      {...props}
    >
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </div>
  );
}

export function BoxKicker({ className, children }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-2.5 text-[10px] uppercase tracking-[.14em] text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
