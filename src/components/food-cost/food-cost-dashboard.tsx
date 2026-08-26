"use client";

import { useMemo } from "react";
import { LayoutDashboard } from "lucide-react";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { calcMenuSelectionCost, calcOverheadPerGuest, calcLaborCostPerGuest, calcFoodCostPct, foodCostColor } from "@/lib/food-cost";

const TARGET_PCT = 30;

/**
 * מדדי דשבורד לפוד-קוסט — "כמות אירועים" = אירועים סגורים עם תפריט נבחר
 * (עתידיים או עברו, לא רק "מתוכננים") שיש להם חישוב פוד-קוסט זמין; "אחוזי
 * ייעול" = גם ממוצע ה-% על פני האירועים האלה, וגם כמה מהם בתוך היעד (≤30%).
 */
export function FoodCostDashboard() {
  const leads = useLeadsStore((s) => s.leads);
  const menuDishes = useLeadsStore((s) => s.menuDishes);
  const ingredients = useLeadsStore((s) => s.ingredients);
  const { orgDoc } = useOrgDoc();

  const stats = useMemo(() => {
    const overheadPerGuest = calcOverheadPerGuest(orgDoc);
    const relevant = leads
      .filter((l) => l.status === "closed")
      .map((lead) => {
        const dishIds = Object.values(lead.menu_selection ?? {}).flat().filter(Boolean) as string[];
        if (dishIds.length === 0) return null;
        const menuCost = calcMenuSelectionCost(dishIds, menuDishes, ingredients);
        const laborPerGuest = calcLaborCostPerGuest({
          staff_count: lead.staff_count,
          staff_hours: lead.staff_hours,
          staff_hourly_rate: lead.staff_hourly_rate,
          estimated_guests: lead.estimated_guests,
        });
        const pct = calcFoodCostPct(menuCost + overheadPerGuest + laborPerGuest, lead.price_per_plate);
        return { leadId: lead.lead_id, pct };
      })
      .filter((x): x is { leadId: string; pct: number } => x !== null && x.pct > 0);

    const count = relevant.length;
    const avgPct = count > 0 ? relevant.reduce((s, r) => s + r.pct, 0) / count : 0;
    const withinTarget = relevant.filter((r) => r.pct <= TARGET_PCT).length;
    const withinTargetPct = count > 0 ? (withinTarget / count) * 100 : 0;

    return { count, avgPct, withinTarget, withinTargetPct };
  }, [leads, menuDishes, ingredients, orgDoc]);

  return (
    <div className="grid gap-3.5">
      <div className="mb-1 flex items-center gap-2">
        <LayoutDashboard className="size-4 text-muted-foreground" />
        <h2 className="text-base">דשבורד פוד-קוסט</h2>
      </div>
      <p className="-mt-2.5 text-sm text-muted-foreground">
        מבוסס על אירועים סגורים עם תפריט נבחר ומחיר לסועד — אירוע בלי תפריט או בלי מחיר לא נכלל.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BlueprintBox className="p-4 sm:p-6">
          <BoxKicker className="mb-1">אירועים עם פוד-קוסט זמין</BoxKicker>
          <div className="text-3xl font-semibold">{stats.count}</div>
        </BlueprintBox>

        <BlueprintBox className="p-4 sm:p-6">
          <BoxKicker className="mb-1">פוד-קוסט ממוצע</BoxKicker>
          <div className="text-3xl font-semibold" style={{ color: stats.count > 0 ? foodCostColor(stats.avgPct) : undefined }}>
            {stats.count > 0 ? `${stats.avgPct.toFixed(0)}%` : "—"}
          </div>
        </BlueprintBox>

        <BlueprintBox className="p-4 sm:p-6">
          <BoxKicker className="mb-1">בתוך יעד (≤{TARGET_PCT}%)</BoxKicker>
          <div className="text-3xl font-semibold">
            {stats.count > 0 ? `${stats.withinTarget}/${stats.count}` : "—"}
          </div>
          {stats.count > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{stats.withinTargetPct.toFixed(0)}% מהאירועים</p>
          )}
        </BlueprintBox>
      </div>
    </div>
  );
}
