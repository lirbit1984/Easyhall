"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Handshake, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { DEFAULT_PLANNING_SUPPLIER_ROLES } from "@/lib/types";

/**
 * מאגר הספקים של האולם. הטופס בתכנון האירוע מציע השלמה אוטומטית מהמאגר הזה,
 * כך שצלם קבוע לא מוקלד מחדש (עם טלפון שגוי) בכל אירוע.
 */
export function SuppliersSettings() {
  const orgSuppliers = useLeadsStore((s) => s.orgSuppliers);
  const addOrgSupplier = useLeadsStore((s) => s.addOrgSupplier);
  const deleteOrgSupplier = useLeadsStore((s) => s.deleteOrgSupplier);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgSuppliers;
    return orgSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.role ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q)
    );
  }, [orgSuppliers, query]);

  const submit = () => {
    if (!name.trim()) {
      toast.error("שם הספק הוא שדה חובה");
      return;
    }
    addOrgSupplier({
      name: name.trim(),
      role: role.trim() || undefined,
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
    });
    setName("");
    setRole("");
    setPhone("");
    setNote("");
    toast.success("הספק נוסף למאגר");
  };

  return (
    <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Handshake className="size-4 text-muted-foreground" />
        <h2 className="text-base">מאגר ספקים</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        צלמים, תקליטנים, רבנים ומעצבים שעובדים איתך קבוע. בטופס תכנון האירוע תקבל השלמה אוטומטית מהמאגר.
      </p>

      <div className="grid gap-2 rounded-lg border border-border p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="sup_name">שם הספק</Label>
            <Input id="sup_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="רונן כהן" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sup_role">תפקיד</Label>
            <Input
              id="sup_role"
              list="supplier_roles"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="צלם"
            />
            <datalist id="supplier_roles">
              {DEFAULT_PLANNING_SUPPLIER_ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sup_phone">טלפון</Label>
            <Input
              id="sup_phone"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sup_note">הערה</Label>
            <Input id="sup_note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="מגיע שעתיים לפני" />
          </div>
        </div>
        <Button className="w-fit gap-1.5" onClick={submit}>
          <Plus className="size-3.5" />
          הוסף ספק
        </Button>
      </div>

      {orgSuppliers.length > 0 && (
        <Input
          className="mt-3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם, תפקיד או טלפון..."
        />
      )}

      <div className="mt-2 grid gap-1.5">
        {orgSuppliers.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין ספקים במאגר.</p>}
        {orgSuppliers.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">לא נמצאו ספקים מתאימים.</p>
        )}
        {filtered.map((s) => (
          <div
            key={s.supplier_id}
            className="flex items-center gap-2 border-t border-border py-2 text-sm first:border-t-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{s.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {[s.phone, s.note].filter(Boolean).join(" · ") || "—"}
              </span>
            </span>
            {s.role && (
              <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                {s.role}
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="מחיקה"
              onClick={() => deleteOrgSupplier(s.supplier_id)}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </BlueprintBox>
  );
}
