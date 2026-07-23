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
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { formatCurrency } from "@/lib/format";
import type { CatalogUnit } from "@/lib/types";
import { CATALOG_UNIT_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const UNITS: CatalogUnit[] = ["per_guest", "fixed"];
const DEFAULT_VAT_PERCENT = 18;
const DEFAULT_DEPOSIT_PERCENT = 20;

export function CatalogSettings() {
  const catalog = useLeadsStore((s) => s.catalog);
  const addCatalogItem = useLeadsStore((s) => s.addCatalogItem);
  const updateCatalogItem = useLeadsStore((s) => s.updateCatalogItem);
  const deleteCatalogItem = useLeadsStore((s) => s.deleteCatalogItem);
  const setOrgVatPercent = useLeadsStore((s) => s.setOrgVatPercent);
  const setOrgDepositSettings = useLeadsStore((s) => s.setOrgDepositSettings);
  const { orgDoc } = useOrgDoc();
  const [vatDraft, setVatDraft] = useState("");
  const [depositMode, setDepositMode] = useState<"percent" | "fixed">(orgDoc?.depositMode ?? "percent");
  const [depositDraft, setDepositDraft] = useState("");

  const vatPercent = orgDoc?.vatPercent ?? DEFAULT_VAT_PERCENT;
  const currentDepositMode = orgDoc?.depositMode ?? "percent";
  const currentDepositValue =
    currentDepositMode === "percent" ? (orgDoc?.depositPercent ?? DEFAULT_DEPOSIT_PERCENT) : (orgDoc?.depositAmount ?? 0);

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

  const saveDeposit = () => {
    const value = Number(depositDraft);
    if (!depositDraft.trim() || Number.isNaN(value) || value < 0) {
      toast.error("יש להזין ערך מקדמה תקין");
      return;
    }
    setOrgDepositSettings(depositMode, value);
    setDepositDraft("");
    toast.success("הגדרת המקדמה עודכנה");
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
    if (!newName.trim() || !price || price <= 0) {
      toast.error("יש להזין שם ומחיר תקין");
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
    if (!editName.trim() || !price || price <= 0) {
      toast.error("יש להזין שם ומחיר תקין");
      return;
    }
    updateCatalogItem(editId!, { name: editName.trim(), unit: editUnit, price });
    setEditId(null);
    toast.success("הפריט עודכן");
  };

  return (
    <BlueprintBox className="mx-auto mt-4 w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Package className="size-4 text-muted-foreground" />
        <h2 className="text-base">מאגר פריטים למכירה</h2>
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

      <div className="mt-2 flex flex-wrap items-end gap-2 border border-dashed border-border p-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">אופן חישוב מקדמה</Label>
          <div className="flex overflow-hidden rounded-md border border-border text-xs">
            <button
              type="button"
              onClick={() => setDepositMode("percent")}
              className={cn(
                "px-3 py-2",
                depositMode === "percent" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              אחוז
            </button>
            <button
              type="button"
              onClick={() => setDepositMode("fixed")}
              className={cn(
                "border-r border-border px-3 py-2",
                depositMode === "fixed" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              סכום קבוע
            </button>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="deposit_value" className="text-xs text-muted-foreground">
            {depositMode === "percent" ? "שיעור מקדמה (%)" : "סכום מקדמה (₪)"}
          </Label>
          <Input
            id="deposit_value"
            type="number"
            dir="ltr"
            placeholder={String(currentDepositValue)}
            value={depositDraft}
            onChange={(e) => setDepositDraft(e.target.value)}
            className="h-9 w-28"
          />
        </div>
        <Button className="h-9" variant="outline" onClick={saveDeposit}>
          עדכן מקדמה
        </Button>
        <span className="text-xs text-muted-foreground">
          נוכחי: {currentDepositMode === "percent" ? `${currentDepositValue}%` : formatCurrency(currentDepositValue)}
        </span>
      </div>

      <Separator className="my-4" />

      {/* Existing items */}
      <div className="grid gap-1.5">
        {catalog.length === 0 && (
          <p className="text-sm text-muted-foreground">אין עדיין פריטים במאגר.</p>
        )}
        {catalog.map((item) => {
          const editing = editId === item.item_id;
          return (
            <div
              key={item.item_id}
              className={cn(
                "flex items-center gap-2 border border-border px-2.5 py-2 text-sm",
                !item.active && "opacity-50"
              )}
            >
              {editing ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 flex-1"
                  />
                  <Select value={editUnit} onValueChange={(v) => v && setEditUnit(v as CatalogUnit)}>
                    <SelectTrigger size="sm" className="w-28">
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
                    className="h-8 w-24"
                    dir="ltr"
                  />
                  <Button size="icon" variant="ghost" className="size-8" onClick={saveEdit}>
                    <Check className="size-4 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditId(null)}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {CATALOG_UNIT_LABELS[item.unit]}
                  </span>
                  <span className="w-24 text-left">{formatCurrency(item.price)}</span>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={(e) =>
                        updateCatalogItem(item.item_id, { active: e.target.checked })
                      }
                    />
                    פעיל
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => startEdit(item.item_id)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => {
                      deleteCatalogItem(item.item_id);
                      toast.success("הפריט נמחק");
                    }}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <Separator className="my-4" />

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
    </BlueprintBox>
  );
}
