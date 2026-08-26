"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { calcOverheadPerGuest } from "@/lib/food-cost";

/**
 * עלות תפעול קבועה חודשית (חשמל/מים/מיסים) שמתחלקת דינמית על תחזית נפח
 * הסועדים המשתנה — לא נצרבת למרכיב בודד, מתווספת כשכבה נפרדת בחישוב
 * הפוד-קוסט לאירוע (ר' src/lib/food-cost.ts). מתחיל ריק עד שה-admin ימלא נתונים.
 */
export function OverheadSettings() {
  const { orgDoc } = useOrgDoc();
  const setOrgFoodCostSettings = useLeadsStore((s) => s.setOrgFoodCostSettings);

  const [overheadDraft, setOverheadDraft] = useState("");
  const [guestsDraft, setGuestsDraft] = useState("");

  useEffect(() => {
    if (!orgDoc) return;
    Promise.resolve().then(() => {
      setOverheadDraft(orgDoc.foodCostMonthlyOverhead != null ? String(orgDoc.foodCostMonthlyOverhead) : "");
      setGuestsDraft(orgDoc.foodCostMonthlyGuestForecast != null ? String(orgDoc.foodCostMonthlyGuestForecast) : "");
    });
  }, [orgDoc]);

  const overheadPerGuest = calcOverheadPerGuest(orgDoc);

  const save = () => {
    const overhead = Number(overheadDraft);
    const guests = Number(guestsDraft);
    if (!overheadDraft.trim() || Number.isNaN(overhead) || overhead < 0) {
      toast.error("יש להזין עלות תפעול חודשית תקינה");
      return;
    }
    if (!guestsDraft.trim() || Number.isNaN(guests) || guests < 0) {
      toast.error("יש להזין תחזית סועדים תקינה");
      return;
    }
    setOrgFoodCostSettings(overhead, guests);
    toast.success("עלויות התפעול עודכנו");
  };

  return (
    <div className="grid gap-3.5">
      <div className="mb-1 flex items-center gap-2">
        <Settings className="size-4 text-muted-foreground" />
        <h2 className="text-base">עלויות תפעול</h2>
      </div>
      <p className="-mt-2.5 max-w-2xl text-sm text-muted-foreground">
        עלות קבועה חודשית (חשמל/מים/מיסים) שמתחלקת דינמית על נפח הסועדים המשתנה שלכם, ומתווספת
        אוטומטית לחישוב הפוד-קוסט של כל אירוע.
      </p>

      <BlueprintBox className="max-w-lg p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">עלות תפעול חודשית ₪</Label>
            <Input
              type="number"
              dir="ltr"
              value={overheadDraft}
              onChange={(e) => setOverheadDraft(e.target.value)}
              placeholder="0"
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">תחזית סועדים חודשית</Label>
            <Input
              type="number"
              dir="ltr"
              value={guestsDraft}
              onChange={(e) => setGuestsDraft(e.target.value)}
              placeholder="0"
              className="h-9"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">תוספת תפעול לסועד</span>
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            {overheadPerGuest > 0 ? `₪${overheadPerGuest.toFixed(2)}` : "—"}
          </span>
        </div>

        <Button className="mt-4 h-9 w-full" onClick={save}>
          שמירה
        </Button>
      </BlueprintBox>
    </div>
  );
}
