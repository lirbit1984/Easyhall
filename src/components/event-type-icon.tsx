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
  type LucideIcon,
} from "lucide-react";
import type { EventTypeIconKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export const EVENT_TYPE_ICON_COMPONENTS: Record<EventTypeIconKey, LucideIcon> = {
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
};

export function EventTypeIcon({
  icon,
  className,
}: {
  icon: EventTypeIconKey | undefined;
  className?: string;
}) {
  const Icon = icon ? EVENT_TYPE_ICON_COMPONENTS[icon] : CalendarHeart;
  return <Icon className={cn(className)} aria-hidden="true" />;
}
