import { RoleGuard } from "@/components/auth/role-guard";
import { FoodCostDashboard } from "@/components/food-cost/food-cost-dashboard";
import { IngredientsSettings } from "@/components/food-cost/ingredients-settings";
import { DishCostSettings } from "@/components/food-cost/dish-cost-settings";
import { OverheadSettings } from "@/components/food-cost/overhead-settings";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function FoodCostPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <div className="p-3 sm:p-6">
        <PageHeader title="פוד-קוסט" subtitle="עלויות גלם, פירוק מנות ועלויות תפעול — לא נראה לזוג/אורחים" />
        <Tabs defaultValue="dashboard" className="min-h-[640px] gap-3.5">
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <TabsList variant="line" className="h-auto w-max justify-start border-b border-border">
              <TabsTrigger value="dashboard" className="flex-none px-4 py-2.5">דשבורד</TabsTrigger>
              <TabsTrigger value="ingredients" className="flex-none px-4 py-2.5">מצרכים</TabsTrigger>
              <TabsTrigger value="dishes" className="flex-none px-4 py-2.5">מנות</TabsTrigger>
              <TabsTrigger value="overhead" className="flex-none px-4 py-2.5">הגדרות</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="dashboard">
            <FoodCostDashboard />
          </TabsContent>
          <TabsContent value="ingredients">
            <IngredientsSettings />
          </TabsContent>
          <TabsContent value="dishes">
            <DishCostSettings />
          </TabsContent>
          <TabsContent value="overhead">
            <OverheadSettings />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
