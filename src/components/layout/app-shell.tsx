"use client";

import { useState } from "react";
import { TopBar } from "./top-bar";
import { SubscriptionBanner } from "./subscription-banner";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <SubscriptionBanner />
      <TopBar onNewLead={() => setNewLeadOpen(true)} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
    </div>
  );
}
