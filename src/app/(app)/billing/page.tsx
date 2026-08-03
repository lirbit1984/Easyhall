"use client";

import { BillingGenerator } from "@/components/billing/billing-generator";
import { BiDashboard } from "@/components/bi/bi-dashboard";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCurrentRole } from "@/lib/firebase/use-current-role";

export default function BillingPage() {
  const role = useCurrentRole();
  // "כספים" (הפקת הצעות מחיר/חוזים) הוא כלי עבודה יומיומי לנציגי מכירות;
  // "דוחות" (BI) שמור ל-admin ולהנהלת חשבונות בלבד.
  const canSeeBilling = role !== "accounting";
  const canSeeReports = role === "admin" || role === "accounting";

  return (
    <RoleGuard allow={["admin", "sales_rep", "accounting"]}>
      <div className="p-3 sm:p-6">
        <PageHeader title="כספים ודוחות" subtitle="הצעות מחיר וחוזים, וביצועי הלידים" />
        <Tabs defaultValue={canSeeBilling ? "billing" : "reports"} className="gap-3.5">
          <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
            {canSeeBilling && (
              <TabsTrigger value="billing" className="flex-none px-4 py-2.5">כספים</TabsTrigger>
            )}
            {canSeeReports && (
              <TabsTrigger value="reports" className="flex-none px-4 py-2.5">דוחות</TabsTrigger>
            )}
          </TabsList>
          {canSeeBilling && (
            <TabsContent value="billing">
              <BillingGenerator />
            </TabsContent>
          )}
          {canSeeReports && (
            <TabsContent value="reports">
              <BiDashboard />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </RoleGuard>
  );
}
