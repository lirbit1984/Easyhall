import { RoleGuard } from "@/components/auth/role-guard";
import { PaymentSettings } from "@/components/settings/payment-settings";

export default function SettingsPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <PaymentSettings />
    </RoleGuard>
  );
}
