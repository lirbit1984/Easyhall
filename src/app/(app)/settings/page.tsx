import { RoleGuard } from "@/components/auth/role-guard";
import { GeneralSettings } from "@/components/settings/general-settings";
import { RepositoriesSettings } from "@/components/settings/repositories-settings";
import { ContractSettings } from "@/components/settings/contract-settings";
import { PlanningPresetsSettings } from "@/components/settings/planning-presets-settings";
import { EventTypesSettings } from "@/components/settings/event-types-settings";
import { IntegrationsSettings } from "@/components/settings/integrations-settings";
import { ManagementSettings } from "@/components/settings/management-settings";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <div className="p-3 sm:p-6">
        <PageHeader title="הגדרות" subtitle="חיבורים, מאגרים, וניהול הצוות" />
        <Tabs defaultValue="general" className="min-h-[640px] gap-3.5">
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <TabsList variant="line" className="h-auto w-max justify-start border-b border-border">
              <TabsTrigger value="general" className="flex-none px-4 py-2.5">כללי</TabsTrigger>
              <TabsTrigger value="repositories" className="flex-none px-4 py-2.5">מאגרים</TabsTrigger>
              <TabsTrigger value="contract" className="flex-none px-4 py-2.5">חוזה</TabsTrigger>
              <TabsTrigger value="planning" className="flex-none px-4 py-2.5">תכנון אירוע</TabsTrigger>
              <TabsTrigger value="event-types" className="flex-none px-4 py-2.5">אנשי קשר לכרטיסי אירוע</TabsTrigger>
              <TabsTrigger value="integrations" className="flex-none px-4 py-2.5">אינטגרציות</TabsTrigger>
              <TabsTrigger value="management" className="flex-none px-4 py-2.5">ניהול</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="general">
            <GeneralSettings />
          </TabsContent>
          <TabsContent value="repositories">
            <RepositoriesSettings />
          </TabsContent>
          <TabsContent value="contract">
            <ContractSettings />
          </TabsContent>
          <TabsContent value="planning">
            <PlanningPresetsSettings />
          </TabsContent>
          <TabsContent value="event-types">
            <EventTypesSettings />
          </TabsContent>
          <TabsContent value="integrations">
            <IntegrationsSettings />
          </TabsContent>
          <TabsContent value="management">
            <ManagementSettings />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
