"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Carrot, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { effectiveUnitCost } from "@/lib/food-cost";
import { INGREDIENT_UNIT_LABELS } from "@/lib/types";
import type { IngredientUnit } from "@/lib/types";

const UNITS = Object.keys(INGREDIENT_UNIT_LABELS) as IngredientUnit[];

/**
 * מאגר מרכיבי הפוד-קוסט (עלויות גלם) — admin בלבד. כל מרכיב: שם, יחידת
 * תמחור, עלות ליחידה, ואחוז ניצולת (בלאי בחיתוך/הכנה). לא מוצג בשום מסך
 * שהזוג/האורחים רואים — רק כאן ובעריכת עלות מנה (טאב "מנות") ובטאב
 * "פוד-קוסט" של כרטיס האירוע.
 */
export function IngredientsSettings() {
  const ingredients = useLeadsStore((s) => s.ingredients);
  const addIngredient = useLeadsStore((s) => s.addIngredient);
  const updateIngredient = useLeadsStore((s) => s.updateIngredient);
  const deleteIngredient = useLeadsStore((s) => s.deleteIngredient);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<IngredientUnit>("kg");
  const [cost, setCost] = useState("");
  const [yieldPct, setYieldPct] = useState("100");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState<IngredientUnit>("kg");
  const [editCost, setEditCost] = useState("");
  const [editYieldPct, setEditYieldPct] = useState("100");

  const submitNew = () => {
    const costNum = Number(cost);
    if (!name.trim()) {
      toast.error("יש להזין שם מצרך");
      return;
    }
    if (!cost.trim() || Number.isNaN(costNum) || costNum < 0) {
      toast.error("יש להזין עלות תקינה");
      return;
    }
    const yieldNum = Number(yieldPct);
    addIngredient({
      name: name.trim(),
      unit,
      cost: costNum,
      yieldPct: !yieldPct.trim() || Number.isNaN(yieldNum) ? 100 : yieldNum,
    });
    setName("");
    setCost("");
    setYieldPct("100");
    toast.success("המצרך נוסף");
  };

  const startEdit = (id: string) => {
    const ing = ingredients.find((i) => i.id === id);
    if (!ing) return;
    setEditId(id);
    setEditName(ing.name);
    setEditUnit(ing.unit);
    setEditCost(String(ing.cost));
    setEditYieldPct(String(ing.yieldPct ?? 100));
  };

  const saveEdit = () => {
    if (!editId) return;
    const costNum = Number(editCost);
    if (!editName.trim() || !editCost.trim() || Number.isNaN(costNum) || costNum < 0) {
      toast.error("נתונים לא תקינים");
      return;
    }
    const yieldNum = Number(editYieldPct);
    updateIngredient(editId, {
      name: editName.trim(),
      unit: editUnit,
      cost: costNum,
      yieldPct: !editYieldPct.trim() || Number.isNaN(yieldNum) ? 100 : yieldNum,
    });
    setEditId(null);
    toast.success("המצרך עודכן");
  };

  return (
    <div className="grid gap-3.5">
      <div className="mb-1 flex items-center gap-2">
        <Carrot className="size-4 text-muted-foreground" />
        <h2 className="text-base">מאגר מצרכים</h2>
      </div>
      <p className="-mt-2.5 text-sm text-muted-foreground">
        עלות גלם לכל מצרך, עם אחוז ניצולת (בלאי בחיתוך/הכנה) — ה&quot;עלות אמיתית&quot; המנוצלת
        היא זו שנכנסת לחישוב עלות המנות בטאב &quot;מנות&quot;.
      </p>

      <BlueprintBox className="p-4 sm:p-6">
        <div className="grid gap-1">
          {ingredients.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין מצרכים במאגר.</p>}
          {ingredients.map((ing) => {
            const editing = editId === ing.id;
            return (
              <div key={ing.id} className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0">
                {editing ? (
                  <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" placeholder="שם" />
                    <Select value={editUnit} onValueChange={(v) => setEditUnit(v as IngredientUnit)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{INGREDIENT_UNIT_LABELS[u]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" dir="ltr" value={editCost} onChange={(e) => setEditCost(e.target.value)} className="h-8" placeholder="עלות ₪" />
                    <Input type="number" dir="ltr" value={editYieldPct} onChange={(e) => setEditYieldPct(e.target.value)} className="h-8" placeholder="ניצולת %" />
                  </div>
                ) : (
                  <div className="grid flex-1 grid-cols-2 gap-1 sm:grid-cols-4">
                    <span>{ing.name}</span>
                    <span className="text-muted-foreground">{INGREDIENT_UNIT_LABELS[ing.unit]}</span>
                    <span className="text-muted-foreground">₪{ing.cost.toFixed(2)} · ניצולת {ing.yieldPct ?? 100}%</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      עלות אמיתית: ₪{effectiveUnitCost(ing).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {editing ? (
                    <>
                      <Button size="icon" variant="ghost" className="size-7" onClick={saveEdit}>
                        <Check className="size-3.5 text-emerald-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditId(null)}>
                        <X className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" className="size-7" aria-label="עריכה" onClick={() => startEdit(ing.id)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label="מחיקה"
                        onClick={() => {
                          deleteIngredient(ing.id);
                          toast.success("המצרך נמחק");
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <BoxKicker className="mb-2 mt-4">מצרך חדש</BoxKicker>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">שם</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: אנטריקוט" className="h-9 w-40" />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">יחידה</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as IngredientUnit)}>
              <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{INGREDIENT_UNIT_LABELS[u]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">עלות ליחידה ₪</Label>
            <Input type="number" dir="ltr" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className="h-9 w-24" />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">ניצולת %</Label>
            <Input type="number" dir="ltr" value={yieldPct} onChange={(e) => setYieldPct(e.target.value)} placeholder="100" className="h-9 w-20" />
          </div>
          <Button className="h-9 gap-1.5" onClick={submitNew}>
            <Plus className="size-3.5" />
            הוסף
          </Button>
        </div>
      </BlueprintBox>
    </div>
  );
}
