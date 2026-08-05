"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
const NEW_TAB = "__new__";

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
    <div className="grid gap-2.5 rounded-lg border border-border p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="event_type_name">שם סוג האירוע</Label>
        <Input
          id="event_type_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
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
        <div className="flex items-center gap-1.5">
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
        <div className="flex items-center gap-1.5">
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
      )}

      {eventType && (
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">אייקון</Label>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
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
      )}

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
 * כרטיס האירוע בקנבן. סוגים אישיים (owner_user_id) לא מנוהלים כאן. כל סוג
 * קיים הוא תת-טאב בפני עצמו; "+ סוג חדש" תמיד בקצה השמאלי (RTL).
 */
export function EventTypesSettings() {
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const addEventType = useLeadsStore((s) => s.addEventType);
  const updateEventType = useLeadsStore((s) => s.updateEventType);
  const deleteEventType = useLeadsStore((s) => s.deleteEventType);

  const globalTypes = eventTypes.filter((t) => !t.owner_user_id);
  const [activeTab, setActiveTab] = useState(NEW_TAB);

  const handleDelete = (id: string) => {
    deleteEventType(id);
    setActiveTab(NEW_TAB);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-sm text-muted-foreground">
        סוגי האירוע הזמינים בטופס &quot;ליד חדש&quot; ובכרטיס האירוע. לכל סוג מגדירים אילו תפקידי אנשי-קשר
        מוצעים לבחירה (למשל &quot;כלה&quot; ו&quot;חתן&quot; לחתונה) וצבע תגית לזיהוי בקנבן.
      </p>
      <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)} className="min-h-[520px] gap-3">
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start border-b border-border">
          {globalTypes.map((t) => (
            <TabsTrigger key={t.event_type_id} value={t.event_type_id} className="flex-none px-4 py-2.5">
              {t.name}
            </TabsTrigger>
          ))}
          <TabsTrigger value={NEW_TAB} className="flex-none px-4 py-2.5">+ סוג חדש</TabsTrigger>
        </TabsList>
        {globalTypes.map((t) => (
          <TabsContent key={t.event_type_id} value={t.event_type_id}>
            <TypeEditor
              eventType={t}
              existingTypes={globalTypes}
              onCreate={() => {}}
              onUpdate={updateEventType}
              onDelete={handleDelete}
            />
          </TabsContent>
        ))}
        <TabsContent value={NEW_TAB}>
          <TypeEditor
            eventType={null}
            existingTypes={globalTypes}
            onCreate={(name, roleKeys) => addEventType(name, roleKeys, null)}
            onUpdate={updateEventType}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
