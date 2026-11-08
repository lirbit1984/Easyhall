"use client";

import { RoleGuard } from "@/components/auth/role-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Commissions } from "@/components/billing/commissions";

export default function CommissionsPage() {
  return (
    <RoleGuard allow={["admin", "accounting", "sales_rep"]}>
      <div className="p-3 sm:p-6">
        <PageHeader title="עמלות" subtitle="לפי חודש הסגירה של כל תאריך" />
        <Commissions />
      </div>
    </RoleGuard>
  );
}
