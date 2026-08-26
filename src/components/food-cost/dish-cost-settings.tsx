"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UtensilsCrossed, Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { calcDishCost } from "@/lib/food-cost";
import { MENU_CATEGORIES, INGREDIENT_UNIT_LABELS } from "@/lib/types";
import type { MenuDish, IngredientUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

const UNITS = Object.keys(INGREDIENT_UNIT_LABELS) as IngredientUnit[];

function DishCostRow({ dish }: { dish: MenuDish }) {
  const ingredients = useLeadsStore((s) => s.ingredients);
  const updateMenuDish = useLeadsStore((s) => s.updateMenuDish);
  const [open, setOpen] = useState(false);
  const [pickIngId, setPickIngId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [pickUnit, setPickUnit] = useState<IngredientUnit | "">("");

  const dishIngredients = dish.ingredients ?? [];
  const cost = calcDishCost(dish, ingredients);
  const pickedIngredient = ingredients.find((i) => i.id === pickIngId);

  const addRow = () => {
    const ing = ingredients.find((i) => i.id === pickIngId);
    const qty = Number(pickQty);
    if (!ing || !pickQty.trim() || Number.isNaN(qty) || qty <= 0) {
      toast.error("בחרו מצרך והזינו כמות תקינה");
      return;
    }
    updateMenuDish(dish.dish_id, {
      ingredients: [...dishIngredients, { ingredientId: ing.id, qty, qtyUnit: pickUnit || ing.unit }],
    });
    setPickIngId("");
    setPickQty("1");
    setPickUnit("");
  };

  const removeRow = (idx: number) => {
    updateMenuDish(dish.dish_id, { ingredients: dishIngredients.filter((_, i) => i !== idx) });
  };

  return (
    <div className="border-t border-border py-2 text-sm first:border-t-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 text-right">
        <span className="min-w-0 flex-1 truncate">{dish.name}</span>
        <span className="shrink-0 font-medium text-emerald-700 dark:text-emerald-400">₪{cost.toFixed(2)}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2 grid gap-2 rounded-md bg-muted/40 p-2.5">
          {dishIngredients.length === 0 && (
            <p className="text-xs text-muted-foreground">אין עדיין מרכיבים למנה הזו.</p>
          )}
          {dishIngredients.map((di, idx) => {
            const ing = ingredients.find((i) => i.id === di.ingredientId);
            return (
              <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                <span>{ing ? ing.name : "(מרכיב נמחק)"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{di.qty} {INGREDIENT_UNIT_LABELS[di.qtyUnit]}</span>
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => removeRow(idx)}>
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={pickIngId} onValueChange={(v) => { setPickIngId(v ?? ""); setPickUnit(""); }}>
              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="בחר מצרך..." /></SelectTrigger>
              <SelectContent>
                {ingredients.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name} ({INGREDIENT_UNIT_LABELS[i.unit]})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              dir="ltr"
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              placeholder="כמות"
              className="h-7 w-16 text-xs"
            />
            {pickedIngredient && (
              <Select value={pickUnit || pickedIngredient.unit} onValueChange={(v) => setPickUnit(v as IngredientUnit)}>
                <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{INGREDIENT_UNIT_LABELS[u]}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addRow}>
              <Plus className="size-3" />
              הוסף
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * עלות פוד-קוסט לכל מנה במאגר (admin בלבד) — מרחיב את מאגר המנות הקיים
 * (MenuDishesSettings) עם פירוק מרכיבים+עלות, בלי לגעת במסך "מנות" הרגיל
 * שהזוג/הצוות רואים בטאב "תפריט" של כרטיס האירוע.
 */
export function DishCostSettings() {
  const menuDishes = useLeadsStore((s) => s.menuDishes);

  return (
    <div className="grid gap-3.5">
      <div className="mb-1 flex items-center gap-2">
        <UtensilsCrossed className="size-4 text-muted-foreground" />
        <h2 className="text-base">עלות מנות</h2>
      </div>
      <p className="-mt-2.5 text-sm text-muted-foreground">
        פירוק מרכיבים ועלות לכל מנה במאגר — לא מוצג בשום מקום שהזוג/האורחים רואים, רק כאן
        ובטאב &quot;פוד-קוסט&quot; של כרטיס האירוע.
      </p>

      {MENU_CATEGORIES.map((category) => {
        const dishes = menuDishes.filter((d) => d.category === category && d.active !== false);
        if (dishes.length === 0) return null;
        return (
          <BlueprintBox key={category} className="p-4 sm:p-6">
            <BoxKicker className="mb-2">{category}</BoxKicker>
            <div className="grid gap-0.5">
              {dishes.map((dish) => <DishCostRow key={dish.dish_id} dish={dish} />)}
            </div>
          </BlueprintBox>
        );
      })}
    </div>
  );
}
