import { RoleGuard } from "@/components/auth/role-guard";
import { PaymentSettings } from "@/components/settings/payment-settings";
import { CatalogSettings } from "@/components/settings/catalog-settings";

export default function SettingsPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <PaymentSettings />
      <CatalogSettings />
    </RoleGuard>
  );
}
