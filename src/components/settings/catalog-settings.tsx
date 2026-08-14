"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { formatCurrency } from "@/lib/format";
import type { CatalogUnit } from "@/lib/types";
import { CATALOG_UNIT_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const UNITS: CatalogUnit[] = ["per_guest", "fixed"];
const DEFAULT_VAT_PERCENT = 18;

export function CatalogSettings() {
  const catalog = useLeadsStore((s) => s.catalog);
  const addCatalogItem = useLeadsStore((s) => s.addCatalogItem);
  const updateCatalogItem = useLeadsStore((s) => s.updateCatalogItem);
  const deleteCatalogItem = useLeadsStore((s) => s.deleteCatalogItem);
  const catalogBundles = useLeadsStore((s) => s.catalogBundles);
  const addCatalogBundle = useLeadsStore((s) => s.addCatalogBundle);
  const updateCatalogBundle = useLeadsStore((s) => s.updateCatalogBundle);
  const deleteCatalogBundle = useLeadsStore((s) => s.deleteCatalogBundle);
  const setOrgVatPercent = useLeadsStore((s) => s.setOrgVatPercent);
  const { orgDoc } = useOrgDoc();
  const [vatDraft, setVatDraft] = useState("");

  const vatPercent = orgDoc?.vatPercent ?? DEFAULT_VAT_PERCENT;

  const saveVat = () => {
    const percent = Number(vatDraft);
    if (!vatDraft.trim() || Number.isNaN(percent) || percent < 0) {
      toast.error("יש להזין שיעור מע״מ תקין");
      return;
    }
    setOrgVatPercent(percent);
    setVatDraft("");
    toast.success("שיעור המע״מ עודכן");
  };

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<CatalogUnit>("per_guest");
  const [newPrice, setNewPrice] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState<CatalogUnit>("per_guest");
  const [editPrice, setEditPrice] = useState("");

  const submitNew = () => {
    const price = Number(newPrice);
    if (!newName.trim() || newPrice.trim() === "" || Number.isNaN(price) || price < 0) {
      toast.error("יש להזין שם ומחיר תקין (0 ומעלה — 0 מציין פריט כלול ללא תוספת מחיר)");
      return;
    }
    addCatalogItem({
      name: newName.trim(),
      unit: newUnit,
      price,
      active: true,
      sort_order: (catalog.at(-1)?.sort_order ?? catalog.length) + 1,
    });
    setNewName("");
    setNewPrice("");
    setNewUnit("per_guest");
    toast.success("הפריט נוסף למאגר");
  };

  const startEdit = (id: string) => {
    const item = catalog.find((c) => c.item_id === id);
    if (!item) return;
    setEditId(id);
    setEditName(item.name);
    setEditUnit(item.unit);
    setEditPrice(String(item.price));
  };

  const saveEdit = () => {
    const price = Number(editPrice);
    if (!editName.trim() || editPrice.trim() === "" || Number.isNaN(price) || price < 0) {
      toast.error("יש להזין שם ומחיר תקין (0 ומעלה — 0 מציין פריט כלול ללא תוספת מחיר)");
      return;
    }
    updateCatalogItem(editId!, { name: editName.trim(), unit: editUnit, price });
    setEditId(null);
    toast.success("הפריט עודכן");
  };

  const [newBundleName, setNewBundleName] = useState("");
  const [newBundleItemIds, setNewBundleItemIds] = useState<string[]>([]);

  const toggleNewBundleItem = (itemId: string) => {
    setNewBundleItemIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const submitBundle = () => {
    if (!newBundleName.trim()) {
      toast.error("יש להזין שם לחבילה");
      return;
    }
    if (newBundleItemIds.length < 2) {
      toast.error("יש לבחור לפחות שני פריטים לחבילה");
      return;
    }
    addCatalogBundle({ name: newBundleName.trim(), item_ids: newBundleItemIds, active: true });
    setNewBundleName("");
    setNewBundleItemIds([]);
    toast.success("החבילה נוספה");
  };

  return (
    <BlueprintBox className="mx-auto mt-4 w-full max-w-4xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Package className="size-4 text-muted-foreground" />
        <h2 className="text-base">מאגר פריטים למכירה וחבילות</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        הפריטים שאפשר להוסיף לעגלת האירוע של הזוג — מחיר מנה, בר, עיצוב, צלם ועוד. יחידת
        &quot;לאורח&quot; מוכפלת בכמות המוזמנים; &quot;מחיר קבוע&quot; נספר פעם אחת.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2 border border-dashed border-border p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="vat_percent" className="text-xs text-muted-foreground">
            שיעור מע״מ (%)
          </Label>
          <Input
            id="vat_percent"
            type="number"
            dir="ltr"
            placeholder={String(vatPercent)}
            value={vatDraft}
            onChange={(e) => setVatDraft(e.target.value)}
            className="h-9 w-28"
          />
        </div>
        <Button className="h-9" variant="outline" onClick={saveVat}>
          עדכן שיעור מע״מ
        </Button>
        <span className="text-xs text-muted-foreground">נוכחי: {vatPercent}%</span>
      </div>

      <Separator className="my-4" />

      <Tabs defaultValue="items" className="gap-3.5">
        <TabsList className="w-fit">
          <TabsTrigger value="items">פריטים ({catalog.length})</TabsTrigger>
          <TabsTrigger value="bundles">חבילות ({catalogBundles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="grid gap-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {catalog.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">אין עדיין פריטים במאגר.</p>
            )}
            {catalog.map((item) => {
              const editing = editId === item.item_id;
              return (
                <div
                  key={item.item_id}
                  className={cn(
                    "grid gap-2 rounded-xl border border-border p-3",
                    !item.active && "opacity-50"
                  )}
                >
                  {editing ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                      />
                      <Select value={editUnit} onValueChange={(v) => v && setEditUnit(v as CatalogUnit)}>
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue>{(v: string) => CATALOG_UNIT_LABELS[v as CatalogUnit]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {CATALOG_UNIT_LABELS[u]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="h-8"
                        dir="ltr"
                      />
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={saveEdit}>
                          <Check className="size-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditId(null)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm">{item.name}</span>
                        <span className="shrink-0 text-sm font-semibold">{formatCurrency(item.price)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[15.75px] text-muted-foreground">
                          {CATALOG_UNIT_LABELS[item.unit]}
                        </span>
                        <label className="flex items-center gap-1 text-[16.5px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={item.active}
                            onChange={(e) =>
                              updateCatalogItem(item.item_id, { active: e.target.checked })
                            }
                          />
                          פעיל
                        </label>
                      </div>
                      <div className="flex justify-end gap-1 border-t border-border pt-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => startEdit(item.item_id)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => {
                            deleteCatalogItem(item.item_id);
                            toast.success("הפריט נמחק");
                          }}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add new item */}
          <div className="grid gap-2 border border-dashed border-border p-3">
            <Label className="text-xs text-muted-foreground">הוספת פריט חדש</Label>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                placeholder="שם הפריט (למשל: DJ)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 min-w-40 flex-1"
              />
              <Select value={newUnit} onValueChange={(v) => v && setNewUnit(v as CatalogUnit)}>
                <SelectTrigger className="w-28">
                  <SelectValue>{(v: string) => CATALOG_UNIT_LABELS[v as CatalogUnit]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {CATALOG_UNIT_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="מחיר ₪"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="h-9 w-28"
                dir="ltr"
              />
              <Button className="h-9 gap-1.5" onClick={submitNew}>
                <Plus className="size-4" />
                הוסף
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bundles" className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            קיבוץ של כמה פריטים (למשל &quot;חבילת פרימיום&quot;: אטרקציות + עיצוב + DJ) שנוספים לעגלה כיחידה אחת
            בלחיצה אחת, במקום פריט-פריט.
          </p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {catalogBundles.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground">אין עדיין חבילות.</p>
            )}
            {catalogBundles.map((bundle) => (
              <div
                key={bundle.bundle_id}
                className={cn(
                  "grid gap-2 rounded-xl border border-dashed border-primary bg-primary/5 p-3",
                  !bundle.active && "opacity-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm">{bundle.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    onClick={() => {
                      deleteCatalogBundle(bundle.bundle_id);
                      toast.success("החבילה נמחקה");
                    }}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {bundle.item_ids.map((id) => {
                    const bundleItem = catalog.find((c) => c.item_id === id);
                    return bundleItem ? (
                      <span key={id} className="rounded-full border border-border bg-background px-2 py-0.5 text-[16.5px]">
                        {bundleItem.name}
                      </span>
                    ) : null;
                  })}
                </div>
                <label className="flex w-fit items-center gap-1 text-[16.5px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={bundle.active}
                    onChange={(e) => updateCatalogBundle(bundle.bundle_id, { active: e.target.checked })}
                  />
                  פעיל
                </label>
              </div>
            ))}
          </div>

          <div className="grid gap-2 border border-dashed border-border p-3">
            <Label className="text-xs text-muted-foreground">הוספת חבילה חדשה</Label>
            <Input
              placeholder="שם החבילה (למשל: חבילת פרימיום)"
              value={newBundleName}
              onChange={(e) => setNewBundleName(e.target.value)}
              className="h-9"
            />
            <div className="flex flex-wrap gap-1.5">
              {catalog.map((item) => {
                const on = newBundleItemIds.includes(item.item_id);
                return (
                  <button
                    key={item.item_id}
                    type="button"
                    onClick={() => toggleNewBundleItem(item.item_id)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.name}
                  </button>
                );
              })}
              {catalog.length === 0 && <p className="text-xs text-muted-foreground">יש להוסיף פריטים למאגר קודם.</p>}
            </div>
            <Button className="w-fit gap-1.5" onClick={submitBundle}>
              <Plus className="size-3.5" />
              הוסף חבילה
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </BlueprintBox>
  );
}
