"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLeadsStore, EVENT_TYPE_COLOR_PALETTE } from "@/store/use-leads-store";
import {
  EVENT_CONTACT_ROLE_LABELS,
  EVENT_TYPE_ICON_KEYS,
  type EventContactRole,
  type EventContactRoleKey,
  type EventType,
} from "@/lib/types";
import { EventTypeIcon } from "@/components/event-type-icon";
import { cn } from "@/lib/utils";

const ROLE_KEYS = Object.keys(EVENT_CONTACT_ROLE_LABELS) as EventContactRoleKey[];
const NEW_TYPE = "__new__";

/** פאנל עריכה שטוח — שם למעלה, ואז תפקידים וצבע+אייקון זה ליד זה, בלי הפרדה נוספת. */
function TypeEditor({
  eventType,
  existingTypes,
  onCreate,
  onUpdate,
  onDelete,
}: {
  eventType: EventType | null;
  existingTypes: EventType[];
  onCreate: (name: string, roleKeys: EventContactRole[]) => void;
  onUpdate: (id: string, updates: Partial<Omit<EventType, "event_type_id">>) => void;
  onDelete: (id: string) => void;
}) {
  const isNew = !eventType;
  const [name, setName] = useState(eventType?.name ?? "");
  const [roleKeys, setRoleKeys] = useState<EventContactRole[]>(eventType?.role_keys ?? []);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const customRoles = roleKeys.filter((k) => !(ROLE_KEYS as string[]).includes(k));

  useEffect(() => {
    setName(eventType?.name ?? "");
    setRoleKeys(eventType?.role_keys ?? []);
    setCustomRoleInput("");
  }, [eventType]);

  const saveName = () => {
    if (!eventType) return;
    if (!name.trim()) {
      toast.error("שם סוג האירוע הוא שדה חובה");
      setName(eventType.name);
      return;
    }
    if (name.trim() !== eventType.name) onUpdate(eventType.event_type_id, { name: name.trim() });
  };

  const toggleRole = (key: EventContactRole) => {
    const next = roleKeys.includes(key) ? roleKeys.filter((k) => k !== key) : [...roleKeys, key];
    setRoleKeys(next);
    if (eventType) onUpdate(eventType.event_type_id, { role_keys: next });
  };

  const addCustomRole = () => {
    const label = customRoleInput.trim();
    if (!label) return;
    if (roleKeys.includes(label)) {
      toast.error("התפקיד כבר קיים ברשימה");
      return;
    }
    const next = [...roleKeys, label];
    setRoleKeys(next);
    setCustomRoleInput("");
    if (eventType) onUpdate(eventType.event_type_id, { role_keys: next });
  };

  const submitNew = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("שם סוג האירוע הוא שדה חובה");
      return;
    }
    if (roleKeys.length === 0) {
      toast.error("יש לבחור לפחות תפקיד איש-קשר אחד");
      return;
    }
    const clash = existingTypes.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase());
    onCreate(trimmedName, roleKeys);
    setName("");
    setRoleKeys([]);
    if (clash) {
      toast.warning(`כבר קיים סוג אירוע בשם "${trimmedName}" — נוצר בכל זאת, כדאי לבדוק אם זו כפילות`);
    } else {
      toast.success("סוג האירוע נוסף");
    }
  };

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="event_type_name">שם סוג האירוע</Label>
        <Input
          id="event_type_name"
          className="max-w-64"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          placeholder="חתונה"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            {customRoles.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleRole(label)}
                aria-pressed
                className="flex items-center gap-1 rounded-full border border-foreground bg-foreground px-2.5 py-1 text-xs text-background"
              >
                {label}
                <Trash2 className="size-3" />
              </button>
            ))}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Input
              value={customRoleInput}
              onChange={(e) => setCustomRoleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomRole();
                }
              }}
              placeholder="תפקיד מותאם אישית (טקסט חופשי)"
              className="h-8 text-xs"
            />
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={addCustomRole}>
              <Plus className="size-3.5" />
              הוסף
            </Button>
          </div>
        </div>

        {eventType && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">צבע</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {EVENT_TYPE_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`צבע ${color}`}
                    aria-pressed={eventType.color === color}
                    onClick={() => onUpdate(eventType.event_type_id, { color })}
                    className={cn(
                      "size-5 rounded-full border-2 transition-transform",
                      eventType.color === color ? "scale-110 border-foreground" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">אייקון</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {EVENT_TYPE_ICON_KEYS.map((key) => {
                  const on = eventType.icon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={key}
                      aria-pressed={on}
                      onClick={() => onUpdate(eventType.event_type_id, { icon: key })}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <EventTypeIcon icon={key} className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {isNew ? (
        <Button className="w-fit gap-1.5" onClick={submitNew}>
          <Plus className="size-3.5" />
          הוסף סוג אירוע
        </Button>
      ) : (
        <Button variant="outline" className="w-fit gap-1.5 text-destructive" onClick={() => onDelete(eventType.event_type_id)}>
          <Trash2 className="size-3.5" />
          מחיקת סוג האירוע
        </Button>
      )}
    </div>
  );
}

/**
 * ניהול סוגי אירוע גלובליים (חתונה, בר מצווה וכו') — role_keys קובע אילו
 * תפקידי אנשי-קשר מוצעים בטופס "ליד חדש" עבור סוג זה, וצבע התגית מוצג על
 * כרטיס האירוע בקנבן. סוגים אישיים (owner_user_id) לא מנוהלים כאן.
 *
 * רשימה קבועה בצד + פאנל עריכה שטוח אחד (במקום טאבים מקוננים) — הרשימה
 * תמיד גלויה כך שמעבר בין סוגים לא מאבד הקשר, והעריכה עצמה בלי הפרדה
 * פנימית נוספת בין תפקידים לצבע/אייקון.
 */
export function EventTypesSettings() {
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const addEventType = useLeadsStore((s) => s.addEventType);
  const updateEventType = useLeadsStore((s) => s.updateEventType);
  const deleteEventType = useLeadsStore((s) => s.deleteEventType);

  const globalTypes = eventTypes.filter((t) => !t.owner_user_id);
  // ברירת המחדל היא הסוג הראשון הקיים ולא "+ סוג חדש" — כדי שמי שנכנס
  // למסך ומתחיל לטגל תפקידים לא יגלה שהוא בפועל מילא טופס יצירה של סוג
  // חדש (שלא נשמר עד לחיצה מפורשת על "הוסף סוג אירוע") במקום לערוך את
  // הסוג הקיים שהוא חשב שהוא רואה.
  const [selected, setSelected] = useState(NEW_TYPE);
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    if (!userPicked && selected === NEW_TYPE && globalTypes.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- self-heals the default selection once async data arrives, not derived from render
      setSelected(globalTypes[0].event_type_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalTypes.length]);

  const handleDelete = (id: string) => {
    deleteEventType(id);
    setSelected(NEW_TYPE);
  };

  const selectedType = globalTypes.find((t) => t.event_type_id === selected) ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-sm text-muted-foreground">
        סוגי האירוע הזמינים בטופס &quot;ליד חדש&quot; ובכרטיס האירוע. לכל סוג מגדירים אילו תפקידי אנשי-קשר
        מוצעים לבחירה (למשל &quot;כלה&quot; ו&quot;חתן&quot; לחתונה) וצבע תגית לזיהוי בקנבן.
      </p>
      <div className="grid grid-cols-[168px_1fr] items-start gap-4">
        <div className="grid gap-0.5">
          {globalTypes.map((t) => (
            <button
              key={t.event_type_id}
              type="button"
              onClick={() => {
                setUserPicked(true);
                setSelected(t.event_type_id);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-muted-foreground transition-colors",
                t.event_type_id === selected
                  ? "bg-muted font-medium text-foreground shadow-sm"
                  : "hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.color ?? "var(--border)" }} />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setUserPicked(true);
              setSelected(NEW_TYPE);
            }}
            className={cn(
              "mt-1.5 border-t border-border px-3 pt-2.5 text-right text-sm font-medium text-primary transition-colors hover:text-primary/80",
              globalTypes.length === 0 && "mt-0 border-t-0 pt-0"
            )}
          >
            + סוג חדש
          </button>
        </div>

        {selected === NEW_TYPE ? (
          <TypeEditor
            key={NEW_TYPE}
            eventType={null}
            existingTypes={globalTypes}
            onCreate={(name, roleKeys) => addEventType(name, roleKeys, null)}
            onUpdate={updateEventType}
            onDelete={handleDelete}
          />
        ) : selectedType ? (
          <TypeEditor
            key={selectedType.event_type_id}
            eventType={selectedType}
            existingTypes={globalTypes}
            onCreate={() => {}}
            onUpdate={updateEventType}
            onDelete={handleDelete}
          />
        ) : null}
      </div>
    </div>
  );
}
