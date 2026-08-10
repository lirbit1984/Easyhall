"use client";

import { PaymentTracking } from "@/components/billing/payment-tracking";
import { BiDashboard } from "@/components/bi/bi-dashboard";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function BillingPage() {
  return (
    <RoleGuard allow={["admin", "accounting"]}>
      <div className="p-3 sm:p-6">
        <PageHeader title="כספים ודוחות" subtitle="מעקב תשלומים וביצועי הלידים" />
        <Tabs defaultValue="billing" className="gap-3.5">
          <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
            <TabsTrigger value="billing" className="flex-none px-4 py-2.5">כספים</TabsTrigger>
            <TabsTrigger value="reports" className="flex-none px-4 py-2.5">דוחות</TabsTrigger>
          </TabsList>
          <TabsContent value="billing">
            <PaymentTracking />
          </TabsContent>
          <TabsContent value="reports">
            <BiDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
