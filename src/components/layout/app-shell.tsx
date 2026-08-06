"use client";

import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { SubscriptionBanner } from "./subscription-banner";
import { QuickActionBar } from "./quick-action-bar";
import { SupportChatWidget } from "@/components/support/support-chat-widget";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SubscriptionBanner />
        <TopBar />
        <main className="flex-1 overflow-x-hidden pb-16">{children}</main>
      </div>
      <QuickActionBar />
      <SupportChatWidget />
    </div>
  );
}
