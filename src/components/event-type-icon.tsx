import type { CSSProperties, ComponentType } from "react";
import {
  Heart,
  HeartHandshake,
  Gem,
  Crown,
  Users,
  UserRound,
  Baby,
  Cake,
  PartyPopper,
  Sparkles,
  Flower2,
  Star,
  GraduationCap,
  Building2,
  Briefcase,
  Handshake,
  Gift,
  Music,
  Wine,
  Utensils,
  Camera,
  Ribbon,
  CalendarHeart,
  Diamond,
  Tent,
  type LucideIcon,
} from "lucide-react";
import type { EventTypeIconKey } from "@/lib/types";
import { cn } from "@/lib/utils";

// lucide-react has no baby-carriage/stroller icon — יד-מצוירת בסגנון lucide
// (stroke=currentColor, קווים מעוגלים) כדי להישאר עקבי עם שאר הסט.
function BabyCarriage({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M4 4c5-1.3 10-.8 13 2.8l1 4.2H5L4 4Z" />
      <path d="M4 4 2 2.2" />
      <path d="M5 11v3" />
      <path d="M18 11v3" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="17" cy="19" r="2" />
    </svg>
  );
}

export const EVENT_TYPE_ICON_COMPONENTS: Record<EventTypeIconKey, ComponentType<{ className?: string; style?: CSSProperties }> | LucideIcon> = {
  heart: Heart,
  "heart-handshake": HeartHandshake,
  gem: Gem,
  crown: Crown,
  users: Users,
  "user-round": UserRound,
  baby: Baby,
  cake: Cake,
  "party-popper": PartyPopper,
  sparkles: Sparkles,
  flower: Flower2,
  star: Star,
  "graduation-cap": GraduationCap,
  building: Building2,
  briefcase: Briefcase,
  handshake: Handshake,
  gift: Gift,
  music: Music,
  wine: Wine,
  utensils: Utensils,
  camera: Camera,
  ribbon: Ribbon,
  "calendar-heart": CalendarHeart,
  diamond: Diamond,
  tent: Tent,
  "baby-carriage": BabyCarriage,
};

export function EventTypeIcon({
  icon,
  className,
  style,
}: {
  icon: EventTypeIconKey | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = icon ? EVENT_TYPE_ICON_COMPONENTS[icon] : CalendarHeart;
  return <Icon className={cn(className)} style={style} aria-hidden="true" />;
}
