"use client";

import { CatalogSettings } from "@/components/settings/catalog-settings";
import { MenuDishesSettings } from "@/components/settings/menu-dishes-settings";
import { OrgFilesSettings } from "@/components/settings/org-files-settings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/** טאב-על שמאחד את כל מאגרי ההגדרות (פריטים, מנות, קבצים) תחת תתי-טאבים אחד. */
export function RepositoriesSettings() {
  return (
    <Tabs defaultValue="items" className="gap-3.5">
      <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
        <TabsTrigger value="items" className="flex-none px-4 py-2.5">מאגר פריטים</TabsTrigger>
        <TabsTrigger value="dishes" className="flex-none px-4 py-2.5">מאגר מנות</TabsTrigger>
        <TabsTrigger value="files" className="flex-none px-4 py-2.5">מאגר קבצים</TabsTrigger>
      </TabsList>
      <TabsContent value="items">
        <CatalogSettings />
      </TabsContent>
      <TabsContent value="dishes">
        <MenuDishesSettings />
      </TabsContent>
      <TabsContent value="files">
        <OrgFilesSettings />
      </TabsContent>
    </Tabs>
  );
}
