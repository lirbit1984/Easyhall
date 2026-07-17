"use client";

import { useState } from "react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { SubscriptionBanner } from "./subscription-banner";
import { NewLeadFab } from "./new-lead-fab";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SubscriptionBanner />
        <TopBar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
      <NewLeadFab onClick={() => setNewLeadOpen(true)} />
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </div>
  );
}
