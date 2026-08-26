import type { Ingredient, IngredientUnit, MenuDish } from "@/lib/types";
import type { OrgDoc } from "@/lib/firebase/use-org-doc";

// מנוע פוד-קוסט טהור (בלי תלות ב-store/React) — תפריט האירוע ← מנות ← מרכיבים,
// עם שתי שכבות עלות מעבר למרכיב הגולמי:
//  1. ניצולת (yieldPct) — בלאי בחיתוך/הכנה, נצרב ברמת המרכיב הבודד.
//  2. תפעול (overhead) — עלות קבועה חודשית (חשמל/מים/מיסים) שמתחלקת דינמית על
//     נפח סועדים משתנה, ולכן מתווספת כשכבה נפרדת ברמת האירוע ולא נצרבת למרכיב.
// לייבור-קוסט (שעות עבודה ÷ מספר מוזמנים) הוא שכבה שלישית, מחושבת בנפרד ב-calcLaborCostPerGuest.

// עלות אמיתית ליחידה מנוצלת, אחרי ניצולת: yieldPct=100/undefined => בלי בלאי.
export function effectiveUnitCost(ingredient: Ingredient): number {
  const yieldPct = ingredient.yieldPct;
  const factor = yieldPct && yieldPct > 0 && yieldPct <= 100 ? yieldPct / 100 : 1;
  return (ingredient.cost || 0) / factor;
}

// גורם המרה מהיחידה שנבחרה בשורת המנה ליחידה שבה המצרך מתומחר (base unit),
// כדי שאפשר יהיה להזין "200 גרם" למרכיב שמתומחר לפי ק"ג.
const UNIT_TO_BASE: Record<IngredientUnit, number> = {
  gram: 0.001,
  kg: 1,
  ml: 0.001,
  liter: 1,
  piece: 1,
};
const BASE_UNIT: Record<IngredientUnit, IngredientUnit> = {
  gram: "kg",
  kg: "kg",
  ml: "liter",
  liter: "liter",
  piece: "piece",
};

function conversionFactor(qtyUnit: IngredientUnit, ingredientUnit: IngredientUnit): number {
  const ingBase = BASE_UNIT[ingredientUnit];
  const qtyBase = BASE_UNIT[qtyUnit];
  if (ingBase !== qtyBase) return 1; // יחידות ממשפחות שונות — אין המרה הגיונית, מניחים 1:1
  return UNIT_TO_BASE[qtyUnit] / UNIT_TO_BASE[ingredientUnit];
}

// עלות המנה: סכום עלות כל מרכיביה, אחרי ניצולת והמרת יחידות.
export function calcDishCost(dish: Pick<MenuDish, "ingredients">, ingredients: Ingredient[]): number {
  return (dish.ingredients ?? []).reduce((sum, di) => {
    const ing = ingredients.find((i) => i.id === di.ingredientId);
    if (!ing) return sum;
    const qtyInIngredientUnit = (di.qty || 0) * conversionFactor(di.qtyUnit, ing.unit);
    return sum + effectiveUnitCost(ing) * qtyInIngredientUnit;
  }, 0);
}

// עלות כל המנות שנבחרו לאירוע (סכום dish_id-ים מכל הקטגוריות).
export function calcMenuSelectionCost(dishIds: string[], allDishes: MenuDish[], ingredients: Ingredient[]): number {
  return dishIds.reduce((sum, id) => {
    const dish = allDishes.find((d) => d.dish_id === id);
    if (!dish) return sum;
    return sum + calcDishCost(dish, ingredients);
  }, 0);
}

// עלות תפעול לסועד = עלות תפעול חודשית ÷ תחזית סועדים חודשית — מתעדכן דינמית.
export function calcOverheadPerGuest(orgDoc: OrgDoc | null): number {
  const overhead = orgDoc?.foodCostMonthlyOverhead ?? 0;
  const guests = orgDoc?.foodCostMonthlyGuestForecast ?? 0;
  if (overhead <= 0 || guests <= 0) return 0;
  return overhead / guests;
}

// לייבור-קוסט לאירוע ספציפי: עובדים × שעות × תעריף שעתי ÷ מספר מוזמנים.
export function calcLaborCostPerGuest(params: {
  staff_count?: number;
  staff_hours?: number;
  staff_hourly_rate?: number;
  estimated_guests: number;
}): number {
  const { staff_count = 0, staff_hours = 0, staff_hourly_rate = 0, estimated_guests } = params;
  if (!estimated_guests || estimated_guests <= 0) return 0;
  const totalLabor = staff_count * staff_hours * staff_hourly_rate;
  return totalLabor / estimated_guests;
}

export function calcFoodCostPct(costPerGuest: number, pricePerGuest: number): number {
  if (!pricePerGuest || pricePerGuest <= 0) return 0;
  return (costPerGuest / pricePerGuest) * 100;
}

// ספי פוד-קוסט סטנדרטיים בתעשייה — ירוק עד 30%, כתום עד 35%, אדום מעל.
export function foodCostColor(pct: number): string {
  return pct <= 30 ? "#16a34a" : pct <= 35 ? "#d97706" : "#dc2626";
}
