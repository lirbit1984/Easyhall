import { BillingGenerator } from "@/components/billing/billing-generator";
import { RoleGuard } from "@/components/auth/role-guard";

export default function BillingPage() {
  return (
    <RoleGuard allow={["admin", "sales_rep"]}>
      <BillingGenerator />
    </RoleGuard>
  );
}
