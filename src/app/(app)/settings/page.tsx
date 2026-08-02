import { RoleGuard } from "@/components/auth/role-guard";
import { PaymentSettings } from "@/components/settings/payment-settings";
import { CatalogSettings } from "@/components/settings/catalog-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { BrandingSettings } from "@/components/settings/branding-settings";
import { OrgFilesSettings } from "@/components/settings/org-files-settings";
import { SuppliersSettings } from "@/components/settings/suppliers-settings";
import { PlanningPresetsSettings } from "@/components/settings/planning-presets-settings";
import { TeamManagement } from "@/components/team/team-management";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <div className="p-3 sm:p-6">
        <PageHeader title="הגדרות" subtitle="חיבורים, קטלוג ופריטים, וניהול הצוות" />
        <Tabs defaultValue="general" className="gap-3.5">
          <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
            <TabsTrigger value="general" className="flex-none px-4 py-2.5">כללי</TabsTrigger>
            <TabsTrigger value="catalog" className="flex-none px-4 py-2.5">מאגר פריטים</TabsTrigger>
            <TabsTrigger value="branding" className="flex-none px-4 py-2.5">מיתוג וחוזה</TabsTrigger>
            <TabsTrigger value="files" className="flex-none px-4 py-2.5">מאגר קבצים</TabsTrigger>
            <TabsTrigger value="suppliers" className="flex-none px-4 py-2.5">מאגר ספקים</TabsTrigger>
            <TabsTrigger value="planning" className="flex-none px-4 py-2.5">תכנון אירוע</TabsTrigger>
            <TabsTrigger value="team" className="flex-none px-4 py-2.5">צוות</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="grid gap-3.5">
            <PaymentSettings />
            <SecuritySettings />
          </TabsContent>
          <TabsContent value="catalog">
            <CatalogSettings />
          </TabsContent>
          <TabsContent value="branding">
            <BrandingSettings />
          </TabsContent>
          <TabsContent value="files">
            <OrgFilesSettings />
          </TabsContent>
          <TabsContent value="suppliers">
            <SuppliersSettings />
          </TabsContent>
          <TabsContent value="planning">
            <PlanningPresetsSettings />
          </TabsContent>
          <TabsContent value="team">
            <TeamManagement />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
