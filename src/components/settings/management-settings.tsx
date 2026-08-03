import { PaymentSettings } from "@/components/settings/payment-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { TeamManagement } from "@/components/team/team-management";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/**
 * הדברים ה"ניהוליים" שלא ניגשים אליהם יום-יום: ניהול הצוות (כולל מטריצת
 * ההרשאות), קודי אבטחה למחיקת כרטיס, וסליקת אשראי.
 */
export function ManagementSettings() {
  return (
    <Tabs defaultValue="team" className="gap-3.5">
      <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
        <TabsTrigger value="team" className="flex-none px-4 py-2.5">צוות</TabsTrigger>
        <TabsTrigger value="security" className="flex-none px-4 py-2.5">אבטחה</TabsTrigger>
        <TabsTrigger value="payment" className="flex-none px-4 py-2.5">סליקה</TabsTrigger>
      </TabsList>
      <TabsContent value="team" className="mx-auto w-full max-w-2xl">
        <TeamManagement />
      </TabsContent>
      <TabsContent value="security">
        <SecuritySettings />
      </TabsContent>
      <TabsContent value="payment">
        <PaymentSettings />
      </TabsContent>
    </Tabs>
  );
}
