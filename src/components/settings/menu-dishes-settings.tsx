"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UtensilsCrossed, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { MENU_CATEGORIES, DEFAULT_MENU_CATEGORY_LIMIT } from "@/lib/types";
import type { MenuCategory } from "@/lib/types";

/**
 * מאגר מנות המטבח, לפי 6 קטגוריות קבועות — נפרד לגמרי ממאגר הפריטים לעגלת
 * התשלומים (מנות תיאוריות בלבד, בלי מחיר). לכל קטגוריה מכסת בחירה מרבית
 * (admin יכול לחרוג ממנה בכרטיס האירוע עצמו).
 */
export function MenuDishesSettings() {
  const menuDishes = useLeadsStore((s) => s.menuDishes);
  const addMenuDish = useLeadsStore((s) => s.addMenuDish);
  const deleteMenuDish = useLeadsStore((s) => s.deleteMenuDish);
  const setMenuCategoryLimit = useLeadsStore((s) => s.setMenuCategoryLimit);
  const { orgDoc } = useOrgDoc();

  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});

  const submitDish = (category: MenuCategory) => {
    const name = (nameDrafts[category] ?? "").trim();
    if (!name) {
      toast.error("יש להזין שם מנה");
      return;
    }
    addMenuDish({ category, name });
    setNameDrafts((d) => ({ ...d, [category]: "" }));
    toast.success("המנה נוספה");
  };

  const saveLimit = (category: MenuCategory) => {
    const raw = limitDrafts[category] ?? "";
    const limit = Number(raw);
    if (!raw.trim() || Number.isNaN(limit) || limit < 0) {
      toast.error("יש להזין מכסה תקינה");
      return;
    }
    setMenuCategoryLimit(category, limit);
    setLimitDrafts((d) => ({ ...d, [category]: "" }));
    toast.success("המכסה עודכנה");
  };

  return (
    <div className="grid gap-3.5">
      <div className="mb-1 flex items-center gap-2">
        <UtensilsCrossed className="size-4 text-muted-foreground" />
        <h2 className="text-base">מאגר מנות</h2>
      </div>
      <p className="-mt-2.5 text-sm text-muted-foreground">
        מנות המטבח לפי קטגוריה, נבחרות בטאב &quot;תפריט&quot; של כרטיס האירוע. לכל קטגוריה מכסת בחירה
        מרבית — admin יכול לחרוג ממנה בכרטיס אירוע ספציפי (למשל מנה עיקרית נוספת במתנה).
      </p>

      {MENU_CATEGORIES.map((category) => {
        const dishes = menuDishes.filter((d) => d.category === category);
        const currentLimit = orgDoc?.menuCategoryLimits?.[category] ?? DEFAULT_MENU_CATEGORY_LIMIT;
        return (
          <BlueprintBox key={category} className="p-4 sm:p-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <BoxKicker className="mb-0">{category}</BoxKicker>
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`limit_${category}`} className="text-xs text-muted-foreground">
                  מכסה
                </Label>
                <Input
                  id={`limit_${category}`}
                  type="number"
                  dir="ltr"
                  min={0}
                  placeholder={String(currentLimit)}
                  value={limitDrafts[category] ?? ""}
                  onChange={(e) => setLimitDrafts((d) => ({ ...d, [category]: e.target.value }))}
                  className="h-8 w-16"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={() => saveLimit(category)}>
                  עדכן
                </Button>
              </div>
            </div>

            <div className="grid gap-1">
              {dishes.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין מנות בקטגוריה זו.</p>}
              {dishes.map((dish) => (
                <div key={dish.dish_id} className="flex items-center gap-2 border-t border-border py-1.5 text-sm first:border-t-0">
                  <span className="flex-1">{dish.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="מחיקה"
                    onClick={() => deleteMenuDish(dish.dish_id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Input
                placeholder="שם מנה חדשה"
                value={nameDrafts[category] ?? ""}
                onChange={(e) => setNameDrafts((d) => ({ ...d, [category]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && submitDish(category)}
                className="h-8 flex-1"
              />
              <Button size="sm" className="h-8 gap-1.5" onClick={() => submitDish(category)}>
                <Plus className="size-3.5" />
                הוסף
              </Button>
            </div>
          </BlueprintBox>
        );
      })}
    </div>
  );
}
