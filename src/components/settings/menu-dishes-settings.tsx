"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UtensilsCrossed, Plus, Trash2, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BlueprintBox, BoxKicker } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { MENU_CATEGORIES, DEFAULT_MENU_CATEGORY_LIMIT } from "@/lib/types";
import type { MenuCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

async function requestDishDescription(name: string, category: string): Promise<string> {
  const res = await fetch("/api/menu-dish-description", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, category }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "שגיאה בניסוח התיאור");
  return data.description as string;
}

/**
 * שדה טקסט עם השלמה אוטומטית "על השורה עצמה" (ghost text) — לא dropdown של
 * הדפדפן, אלא טקסט אפור שממשיך את המילה מתוך מנות קיימות באותה קטגוריה.
 * Tab / חץ ימינה / End מאמצים את ההשלמה, כל תו נוסף מחשב אותה מחדש.
 */
function DishNameInput({
  value,
  onChange,
  onSubmit,
  suggestions,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  suggestions: string[];
  placeholder: string;
}) {
  const suggestion = useMemo(() => {
    if (!value.trim()) return "";
    const match = suggestions.find(
      (n) => n.toLowerCase().startsWith(value.toLowerCase()) && n.toLowerCase() !== value.toLowerCase()
    );
    return match ? match.slice(value.length) : "";
  }, [value, suggestions]);

  const acceptSuggestion = () => {
    if (suggestion) onChange(value + suggestion);
  };

  return (
    <div className="relative flex-1">
      {suggestion && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-2.5 text-base md:text-sm"
        >
          <span className="invisible">{value}</span>
          <span className="text-muted-foreground/70">{suggestion}</span>
        </div>
      )}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (suggestion && (e.key === "Tab" || e.key === "ArrowRight" || e.key === "End")) {
            e.preventDefault();
            acceptSuggestion();
            return;
          }
          if (e.key === "Enter") onSubmit();
        }}
        className="relative z-10 h-8 border-2 border-muted-foreground/40 bg-transparent focus-visible:border-ring dark:bg-transparent"
      />
    </div>
  );
}

/**
 * מאגר מנות המטבח, לפי 6 קטגוריות קבועות — נפרד לגמרי ממאגר הפריטים לעגלת
 * התשלומים (מנות תיאוריות בלבד, בלי מחיר). לכל קטגוריה מכסת בחירה מרבית
 * (admin יכול לחרוג ממנה בכרטיס האירוע עצמו).
 */
export function MenuDishesSettings() {
  const menuDishes = useLeadsStore((s) => s.menuDishes);
  const addMenuDish = useLeadsStore((s) => s.addMenuDish);
  const updateMenuDish = useLeadsStore((s) => s.updateMenuDish);
  const deleteMenuDish = useLeadsStore((s) => s.deleteMenuDish);
  const setMenuCategoryLimit = useLeadsStore((s) => s.setMenuCategoryLimit);
  const leads = useLeadsStore((s) => s.leads);
  const { orgDoc } = useOrgDoc();

  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [descDrafts, setDescDrafts] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowAiLoading, setRowAiLoading] = useState<Record<string, boolean>>({});
  const [descEditId, setDescEditId] = useState<string | null>(null);
  const [descEditDraft, setDescEditDraft] = useState("");

  // כמה פעמים כל מנה נבחרה בפועל בכרטיסי אירוע — נותן ל-admin אינדיקציה
  // איזה מנות פופולריות ואיזה כדאי אולי להוריד מהמאגר.
  const selectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      Object.values(l.menu_selection ?? {}).forEach((ids) => {
        (ids ?? []).forEach((id) => {
          counts[id] = (counts[id] ?? 0) + 1;
        });
      });
    });
    return counts;
  }, [leads]);

  // שדה המכסה מציג את הערך האמיתי (לא placeholder על שדה ריק) — כדי שחצי
  // ה-spinner של <input type="number"> יספרו מהמכסה הנוכחית, ואפשר יהיה
  // לסמן את המספר ולהקליד ערך אחר ישירות.
  useEffect(() => {
    if (!orgDoc) return;
    Promise.resolve().then(() => {
      setLimits(
        Object.fromEntries(
          MENU_CATEGORIES.map((c) => [c, String(orgDoc.menuCategoryLimits?.[c] ?? DEFAULT_MENU_CATEGORY_LIMIT)])
        )
      );
    });
  }, [orgDoc]);

  const isDuplicate = (category: MenuCategory, name: string, excludeId?: string) =>
    menuDishes.some(
      (d) =>
        d.category === category &&
        d.dish_id !== excludeId &&
        d.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const submitDish = (category: MenuCategory) => {
    const name = (nameDrafts[category] ?? "").trim();
    if (!name) {
      toast.error("יש להזין שם מנה");
      return;
    }
    if (isDuplicate(category, name)) {
      toast.error(`"${name}" כבר קיימת בקטגוריה הזו`);
      return;
    }
    addMenuDish({ category, name, description: (descDrafts[category] ?? "").trim() || undefined });
    setNameDrafts((d) => ({ ...d, [category]: "" }));
    setDescDrafts((d) => ({ ...d, [category]: "" }));
    toast.success("המנה נוספה");
  };

  const saveLimit = (category: MenuCategory) => {
    const raw = limits[category] ?? "";
    const limit = Number(raw);
    if (!raw.trim() || Number.isNaN(limit) || limit < 0) {
      toast.error("יש להזין מכסה תקינה");
      return;
    }
    setMenuCategoryLimit(category, limit);
    toast.success("המכסה עודכנה");
  };

  const generateDescription = async (category: MenuCategory) => {
    const name = (nameDrafts[category] ?? "").trim();
    if (!name) {
      toast.error("יש להזין קודם שם מנה");
      return;
    }
    setAiLoading((s) => ({ ...s, [category]: true }));
    try {
      const description = await requestDishDescription(name, category);
      setDescDrafts((d) => ({ ...d, [category]: description }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בניסוח התיאור");
    } finally {
      setAiLoading((s) => ({ ...s, [category]: false }));
    }
  };

  // ניסוח AI למנה קיימת — פותח את התיאור לעריכה לפני שהוא נשמר, כדי שאפשר
  // יהיה לתקן/לקצר לפני הצירוף בפועל (במקום לשמור אוטומטית בלי בקרה).
  const generateRowDraft = async (dishId: string, name: string, category: MenuCategory) => {
    setRowAiLoading((s) => ({ ...s, [dishId]: true }));
    try {
      const description = await requestDishDescription(name, category);
      setDescEditId(dishId);
      setDescEditDraft(description);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בניסוח התיאור");
    } finally {
      setRowAiLoading((s) => ({ ...s, [dishId]: false }));
    }
  };

  const startEditDescription = (dishId: string, description?: string) => {
    setDescEditId(dishId);
    setDescEditDraft(description ?? "");
  };

  const saveDescription = (dishId: string) => {
    updateMenuDish(dishId, { description: descEditDraft.trim() || undefined });
    setDescEditId(null);
    toast.success("התיאור נשמר");
  };

  const startEdit = (dishId: string, name: string) => {
    setEditingId(dishId);
    setEditingName(name);
  };

  const saveEdit = (category: MenuCategory) => {
    const name = editingName.trim();
    if (!editingId) return;
    if (!name) {
      toast.error("שם המנה לא יכול להיות ריק");
      return;
    }
    if (isDuplicate(category, name, editingId)) {
      toast.error(`"${name}" כבר קיימת בקטגוריה הזו`);
      return;
    }
    updateMenuDish(editingId, { name });
    setEditingId(null);
    toast.success("השם עודכן");
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
                  value={limits[category] ?? String(DEFAULT_MENU_CATEGORY_LIMIT)}
                  onChange={(e) => setLimits((d) => ({ ...d, [category]: e.target.value }))}
                  className="h-8 w-16"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={() => saveLimit(category)}>
                  עדכן
                </Button>
              </div>
            </div>

            <div className="grid gap-1">
              {dishes.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין מנות בקטגוריה זו.</p>}
              {dishes.map((dish) => {
                const editing = editingId === dish.dish_id;
                const count = selectionCounts[dish.dish_id] ?? 0;
                return (
                  <div key={dish.dish_id} className="flex items-start gap-2 border-t border-border py-1.5 text-sm first:border-t-0">
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(category);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 flex-1"
                          />
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => saveEdit(category)}>
                            <Check className="size-3.5 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingId(null)}>
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(dish.dish_id, dish.name)}
                          className="text-right hover:underline"
                          title="לחיצה לעריכת השם"
                        >
                          {dish.name}
                        </button>
                      )}
                      {descEditId === dish.dish_id ? (
                        <div className="mt-1 grid gap-1">
                          <Textarea
                            autoFocus
                            value={descEditDraft}
                            onChange={(e) => setDescEditDraft(e.target.value)}
                            rows={2}
                            className="text-xs"
                            placeholder="תיאור המנה..."
                          />
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              disabled={!!rowAiLoading[dish.dish_id]}
                              onClick={() => generateRowDraft(dish.dish_id, dish.name, category)}
                            >
                              <Sparkles className={cn("size-3", rowAiLoading[dish.dish_id] && "animate-pulse")} />
                              {rowAiLoading[dish.dish_id] ? "מנסח..." : "נסח מחדש"}
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => saveDescription(dish.dish_id)}>
                              <Check className="size-3.5 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => setDescEditId(null)}>
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditDescription(dish.dish_id, dish.description)}
                          className="block text-right text-[11px] text-muted-foreground hover:underline"
                          title="לחיצה לעריכת התיאור"
                        >
                          {dish.description || "+ הוסף תיאור"}
                        </button>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                        {count === 0 ? "טרם נבחרה באירוע" : `נבחרה ב-${count} אירועים`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0"
                      aria-label="נסח תיאור עם AI"
                      title="נסח תיאור עם AI (לעריכה לפני שמירה)"
                      disabled={!!rowAiLoading[dish.dish_id]}
                      onClick={() => generateRowDraft(dish.dish_id, dish.name, category)}
                    >
                      <Sparkles className={cn("size-3.5", rowAiLoading[dish.dish_id] && "animate-pulse")} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0"
                      aria-label="מחיקה"
                      onClick={() => deleteMenuDish(dish.dish_id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 grid gap-1.5">
              <div className="flex items-center gap-2">
                <DishNameInput
                  value={nameDrafts[category] ?? ""}
                  onChange={(v) => setNameDrafts((d) => ({ ...d, [category]: v }))}
                  onSubmit={() => submitDish(category)}
                  suggestions={dishes.map((d) => d.name)}
                  placeholder="שם מנה חדשה"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  disabled={!!aiLoading[category]}
                  onClick={() => generateDescription(category)}
                >
                  <Sparkles className="size-3.5" />
                  {aiLoading[category] ? "מנסח..." : "נסח עם AI"}
                </Button>
                <Button size="sm" className="h-8 gap-1.5" onClick={() => submitDish(category)}>
                  <Plus className="size-3.5" />
                  הוסף
                </Button>
              </div>
              {descDrafts[category] && (
                <Textarea
                  value={descDrafts[category]}
                  onChange={(e) => setDescDrafts((d) => ({ ...d, [category]: e.target.value }))}
                  rows={2}
                  className="text-xs"
                  placeholder="תיאור המנה — יצורף אוטומטית כשלוחצים הוסף"
                />
              )}
            </div>
          </BlueprintBox>
        );
      })}
    </div>
  );
}
