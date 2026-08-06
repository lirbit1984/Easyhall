import { Suspense } from "react";
import { LeadCardsView } from "@/components/leads/lead-cards-view";

export default function KanbanPage() {
  return (
    <Suspense>
      <LeadCardsView />
    </Suspense>
  );
}
