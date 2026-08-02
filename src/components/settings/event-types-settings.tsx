"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tag, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { useLeadsStore, EVENT_TYPE_COLOR_PALETTE } from "@/store/use-leads-store";
import {
  EVENT_CONTACT_ROLE_LABELS,
  type EventContactRoleKey,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_KEYS = Object.keys(EVENT_CONTACT_ROLE_LABELS) as EventContactRoleKey[];

/**
 * ניהול סוגי אירוע גלובליים (חתונה, בר מצווה וכו') — role_keys קובע אילו
 * תפקידי אנשי-קשר מוצעים בטופס "ליד חדש" עבור סוג זה, וצבע התגית מוצג
 * על כרטיס האירוע בקנבן. סוגים אישיים (owner_user_id) לא מנוהלים כאן.
 */
export function EventTypesSettings() {
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const addEventType = useLeadsStore((s) => s.addEventType);
  const updateEventType = useLeadsStore((s) => s.updateEventType);
  const deleteEventType = useLeadsStore((s) => s.deleteEventType);

  const [name, setName] = useState("");
  const [roleKeys, setRoleKeys] = useState<EventContactRoleKey[]>([]);

  const globalTypes = eventTypes.filter((t) => !t.owner_user_id);

  const toggleRole = (key: EventContactRoleKey) =>
    setRoleKeys((r) => (r.includes(key) ? r.filter((k) => k !== key) : [...r, key]));

  const submit = () => {
    if (!name.trim()) {
      toast.error("שם סוג האירוע הוא שדה חובה");
      return;
    }
    if (roleKeys.length === 0) {
      toast.error("יש לבחור לפחות תפקיד איש-קשר אחד");
      return;
    }
    addEventType(name.trim(), roleKeys, null);
    setName("");
    setRoleKeys([]);
    toast.success("סוג האירוע נוסף");
  };

  return (
    <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Tag className="size-4 text-muted-foreground" />
        <h2 className="text-base">סוגי אירוע</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        סוגי האירוע הזמינים בטופס &quot;ליד חדש&quot; ובכרטיס האירוע. לכל סוג מגדירים אילו תפקידי אנשי-קשר
        מוצעים לבחירה (למשל &quot;כלה&quot; ו&quot;חתן&quot; לחתונה) וצבע תגית לזיהוי בקנבן.
      </p>

      <div className="grid gap-2.5 rounded-lg border border-border p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="event_type_name">שם סוג האירוע</Label>
          <Input
            id="event_type_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="חתונה"
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">תפקידי אנשי-קשר מוצעים</Label>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_KEYS.map((key) => {
              const on = roleKeys.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleRole(key)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {EVENT_CONTACT_ROLE_LABELS[key]}
                </button>
              );
            })}
          </div>
        </div>

        <Button className="w-fit gap-1.5" onClick={submit}>
          <Plus className="size-3.5" />
          הוסף סוג אירוע
        </Button>
      </div>

      <div className="mt-3 grid gap-1.5">
        {globalTypes.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין סוגי אירוע.</p>}
        {globalTypes.map((t) => (
          <div key={t.event_type_id} className="border-t border-border py-2.5 text-sm first:border-t-0">
            <div className="flex items-start justify-between gap-2">
              <Input
                value={t.name}
                onChange={(e) => updateEventType(t.event_type_id, { name: e.target.value })}
                className="h-7 max-w-48 border-none bg-transparent px-1 font-medium shadow-none focus-visible:border-input focus-visible:bg-background"
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                aria-label="מחיקה"
                onClick={() => deleteEventType(t.event_type_id)}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ROLE_KEYS.map((key) => {
                const on = t.role_keys.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      updateEventType(t.event_type_id, {
                        role_keys: on ? t.role_keys.filter((k) => k !== key) : [...t.role_keys, key],
                      })
                    }
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {EVENT_CONTACT_ROLE_LABELS[key]}
                  </button>
                );
              })}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5">
              {EVENT_TYPE_COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`צבע ${color}`}
                  aria-pressed={t.color === color}
                  onClick={() => updateEventType(t.event_type_id, { color })}
                  className={cn(
                    "size-5 rounded-full border-2 transition-transform",
                    t.color === color ? "scale-110 border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </BlueprintBox>
  );
}
