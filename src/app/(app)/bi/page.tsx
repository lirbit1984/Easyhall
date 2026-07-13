import { BiDashboard } from "@/components/bi/bi-dashboard";
import { RoleGuard } from "@/components/auth/role-guard";

export default function BiPage() {
  return (
    <RoleGuard allow={["admin", "sales_rep"]}>
      <BiDashboard />
    </RoleGuard>
  );
}
