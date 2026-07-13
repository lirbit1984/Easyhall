"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { cn } from "@/lib/utils";

const FALLBACK_COLORS = ["#6366f1", "#ec4899", "#0ea5e9", "#22c55e", "#f59e0b", "#a855f7"];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function RepAvatar({
  userId,
  size = "default",
  className,
}: {
  userId: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const { members } = useOrgMembers();
  const user = members.find((m) => m.user_id === userId);
  if (!user) return null;
  const initials = user.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <Avatar size={size} className={className} title={user.full_name}>
      <AvatarFallback
        style={{ backgroundColor: user.avatar_color ?? colorFromId(user.user_id), color: "white" }}
        className={cn("font-medium")}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
