"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeadsStore } from "@/store/use-leads-store";
import { PLANNING_SECTION_KEYS, PLANNING_SECTION_LABELS } from "@/lib/types";
import type { PlanningSectionKey, PlanningPreset, EventType } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_EVENT_TYPE = "__none__";
const NEW_PRESET = "__new__";

/** פאנל עריכה שטוח — שם למעלה, שיוך סוג אירוע וכרטיסיות זה ליד זה, כמו TypeEditor באנשי הקשר. */
function PresetEditor({
  preset,
  eventTypes,
  existingPresets,
  onCreate,
  onUpdate,
  onDelete,
}: {
  preset: PlanningPreset | null;
  eventTypes: EventType[];
  existingPresets: PlanningPreset[];
  onCreate: (data: { name: string; event_type_id: string | null; sections: PlanningSectionKey[] }) => void;
  onUpdate: (id: string, updates: Partial<Omit<PlanningPreset, "preset_id" | "created_at">>) => void;
  onDelete: (id: string) => void;
}) {
  const isNew = !preset;
  const [name, setName] = useState(preset?.name ?? "");
  const [eventTypeId, setEventTypeId] = useState(preset?.event_type_id ?? NO_EVENT_TYPE);
  const [sections, setSections] = useState<PlanningSectionKey[]>(preset?.sections ?? [...PLANNING_SECTION_KEYS]);

  const toggleSection = (key: PlanningSectionKey) => {
    const next = sections.includes(key) ? sections.filter((k) => k !== key) : [...sections, key];
    setSections(next);
    if (preset) onUpdate(preset.preset_id, { sections: next });
  };

  const saveName = () => {
    if (!preset) return;
    if (!name.trim()) {
      toast.error("שם הפריסט הוא שדה חובה");
      setName(preset.name);
      return;
    }
    if (name.trim() !== preset.name) onUpdate(preset.preset_id, { name: name.trim() });
  };

  const changeEventType = (v: string) => {
    setEventTypeId(v);
    if (!preset) return;
    const resolved = v === NO_EVENT_TYPE ? null : v;
    const clashing = resolved ? existingPresets.find((p) => p.event_type_id === resolved && p.preset_id !== preset.preset_id) : undefined;
    onUpdate(preset.preset_id, { event_type_id: resolved });
    if (clashing) {
      toast.warning(`"${clashing.name}" כבר משויך לאותו סוג אירוע — רק הראשון ברשימה ייטען אוטומטית`);
    }
  };

  const submitNew = () => {
    if (!name.trim()) {
      toast.error("שם הפריסט הוא שדה חובה");
      return;
    }
    if (sections.length === 0) {
      toast.error("יש לבחור לפחות כרטיסייה אחת");
      return;
    }
    const resolvedEventTypeId = eventTypeId === NO_EVENT_TYPE ? null : eventTypeId;
    const clashing = resolvedEventTypeId ? existingPresets.find((p) => p.event_type_id === resolvedEventTypeId) : undefined;
    onCreate({ name: name.trim(), event_type_id: resolvedEventTypeId, sections });
    setName("");
    setEventTypeId(NO_EVENT_TYPE);
    setSections([...PLANNING_SECTION_KEYS]);
    if (clashing) {
      toast.warning(`הפריסט נוסף, אבל "${clashing.name}" כבר משויך לאותו סוג אירוע — רק הראשון ברשימה ייטען אוטומטית`);
    } else {
      toast.success("הפריסט נוסף");
    }
  };

  const linkedType = preset ? eventTypes.find((t) => t.event_type_id === preset.event_type_id) : undefined;

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="preset_name">שם הפריסט</Label>
        <Input
          id="preset_name"
          className="max-w-64"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          placeholder="חתונה"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">שיוך אוטומטי לסוג אירוע</Label>
          <Select value={eventTypeId} onValueChange={(v) => v && changeEventType(v)}>
            <SelectTrigger className="w-fit text-xs">
              <SelectValue>
                {(v: string) =>
                  v === NO_EVENT_TYPE ? "ללא שיוך (בחירה ידנית)" : eventTypes.find((t) => t.event_type_id === v)?.name ?? v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_EVENT_TYPE}>ללא שיוך (בחירה ידנית)</SelectItem>
              {eventTypes.map((t) => (
                <SelectItem key={t.event_type_id} value={t.event_type_id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">כרטיסיות מוצגות</Label>
          <Popover>
            <PopoverTrigger
              render={<button type="button" className="flex w-fit items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs" />}
            >
              {sections.length === 0 ? "בחירת כרטיסיות" : `${sections.length} כרטיסיות נבחרו`}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="w-auto">
              <div className="flex max-w-64 flex-wrap gap-1.5">
                {PLANNING_SECTION_KEYS.map((key) => {
                  const on = sections.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSection(key)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {PLANNING_SECTION_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {linkedType && (
        <Badge variant="secondary" className="w-fit rounded-full text-[10px]">
          שיוך אוטומטי — {linkedType.name}
        </Badge>
      )}

      {isNew ? (
        <Button className="w-fit gap-1.5" onClick={submitNew}>
          <Plus className="size-3.5" />
          הוסף פריסט
        </Button>
      ) : (
        <Button variant="outline" className="w-fit gap-1.5 text-destructive" onClick={() => onDelete(preset.preset_id)}>
          <Trash2 className="size-3.5" />
          מחיקת פריסט
        </Button>
      )}
    </div>
  );
}

/**
 * פריסטים לטופס תכנון האירוע: אילו כרטיסיות מוצגות לכל סוג אירוע (ברית לא
 * צריכה סדר חופה, אירוע חברה לא צריך בקשות כשרות). רשימה קבועה בצד + פאנל
 * עריכה שטוח אחד — אותו מבנה כמו "אנשי קשר לכרטיסי אירוע".
 */
export function PlanningPresetsSettings() {
  const allEventTypes = useLeadsStore((s) => s.eventTypes);
  const eventTypes = allEventTypes.filter((t) => !t.owner_user_id);
  const presets = useLeadsStore((s) => s.planningPresets);
  const addPlanningPreset = useLeadsStore((s) => s.addPlanningPreset);
  const updatePlanningPreset = useLeadsStore((s) => s.updatePlanningPreset);
  const deletePlanningPreset = useLeadsStore((s) => s.deletePlanningPreset);

  const [selected, setSelected] = useState(NEW_PRESET);
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    if (!userPicked && selected === NEW_PRESET && presets.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- self-heals the default selection once async data arrives, not derived from render
      setSelected(presets[0].preset_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets.length]);

  const handleDelete = (id: string) => {
    deletePlanningPreset(id);
    setSelected(NEW_PRESET);
  };

  const selectedPreset = presets.find((p) => p.preset_id === selected) ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-sm text-muted-foreground">
        קובעים אילו כרטיסיות מופיעות בטאב &quot;תכנון האירוע&quot; לכל סוג אירוע — לברית או לאירוע חברה אין
        צורך בסדר חופה, לדוגמה. פריסט המשויך לסוג אירוע נטען אוטומטית; ליד עם סוג ללא שיוך יציע בחירה ידנית.
      </p>
      <div className="grid grid-cols-[168px_1fr] items-start gap-4">
        <div className="grid gap-0.5">
          {presets.map((p) => (
            <button
              key={p.preset_id}
              type="button"
              onClick={() => {
                setUserPicked(true);
                setSelected(p.preset_id);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-muted-foreground transition-colors",
                p.preset_id === selected
                  ? "bg-muted font-medium text-foreground shadow-sm"
                  : "hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setUserPicked(true);
              setSelected(NEW_PRESET);
            }}
            className={cn(
              "mt-1.5 border-t border-border px-3 pt-2.5 text-right text-sm font-medium text-primary transition-colors hover:text-primary/80",
              presets.length === 0 && "mt-0 border-t-0 pt-0"
            )}
          >
            + פריסט חדש
          </button>
        </div>

        {selected === NEW_PRESET ? (
          <PresetEditor
            key={NEW_PRESET}
            preset={null}
            eventTypes={eventTypes}
            existingPresets={presets}
            onCreate={(data) => addPlanningPreset(data)}
            onUpdate={updatePlanningPreset}
            onDelete={handleDelete}
          />
        ) : selectedPreset ? (
          <PresetEditor
            key={selectedPreset.preset_id}
            preset={selectedPreset}
            eventTypes={eventTypes}
            existingPresets={presets}
            onCreate={() => {}}
            onUpdate={updatePlanningPreset}
            onDelete={handleDelete}
          />
        ) : null}
      </div>
    </div>
  );
}
