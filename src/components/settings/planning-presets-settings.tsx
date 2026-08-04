"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeadsStore } from "@/store/use-leads-store";
import { PLANNING_SECTION_KEYS, PLANNING_SECTION_LABELS } from "@/lib/types";
import type { PlanningSectionKey, PlanningPreset, EventType } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_EVENT_TYPE = "__none__";
const NEW_TAB = "__new__";

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
    <div className="grid gap-2.5 rounded-lg border border-border p-3">
      {!isNew && <h3 className="text-lg font-semibold">{preset.name}</h3>}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="preset_name">שם הפריסט</Label>
          <Input
            id="preset_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            placeholder="חתונה"
            className="text-base font-medium"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>שיוך אוטומטי לסוג אירוע</Label>
          <Select value={eventTypeId} onValueChange={(v) => v && changeEventType(v)}>
            <SelectTrigger className="w-full">
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
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">כרטיסיות מוצגות</Label>
        <div className="flex flex-wrap gap-1.5">
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
      </div>

      {linkedType && (
        <Badge variant="secondary" className="w-fit rounded-full text-[10px]">
          שיוך אוטומטי
        </Badge>
      )}

      <div className="flex items-center gap-2">
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
    </div>
  );
}

/**
 * פריסטים לטופס תכנון האירוע: אילו כרטיסיות מוצגות לכל סוג אירוע (ברית לא
 * צריכה סדר חופה, אירוע חברה לא צריך בקשות כשרות). כל פריסט קיים הוא תת-טאב
 * בפני עצמו; תת-הטאב האחרון ("+ פריסט חדש") תמיד בקצה השמאלי (RTL).
 */
export function PlanningPresetsSettings() {
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const presets = useLeadsStore((s) => s.planningPresets);
  const addPlanningPreset = useLeadsStore((s) => s.addPlanningPreset);
  const updatePlanningPreset = useLeadsStore((s) => s.updatePlanningPreset);
  const deletePlanningPreset = useLeadsStore((s) => s.deletePlanningPreset);

  const [activeTab, setActiveTab] = useState(NEW_TAB);

  const handleDelete = (id: string) => {
    deletePlanningPreset(id);
    setActiveTab(NEW_TAB);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="mb-3 text-sm text-muted-foreground">
        קובעים אילו כרטיסיות מופיעות בטאב &quot;תכנון האירוע&quot; לכל סוג אירוע — לברית או לאירוע חברה אין
        צורך בסדר חופה, לדוגמה. פריסט המשויך לסוג אירוע נטען אוטומטית; ליד עם סוג ללא שיוך יציע בחירה ידנית.
      </p>
      <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)} className="min-h-[520px] gap-3">
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start border-b border-border">
          {presets.map((p) => (
            <TabsTrigger key={p.preset_id} value={p.preset_id} className="flex-none px-4 py-2.5">
              {p.name}
            </TabsTrigger>
          ))}
          <TabsTrigger value={NEW_TAB} className="flex-none px-4 py-2.5">+ פריסט חדש</TabsTrigger>
        </TabsList>
        {presets.map((p) => (
          <TabsContent key={p.preset_id} value={p.preset_id}>
            <PresetEditor
              preset={p}
              eventTypes={eventTypes}
              existingPresets={presets}
              onCreate={() => {}}
              onUpdate={updatePlanningPreset}
              onDelete={handleDelete}
            />
          </TabsContent>
        ))}
        <TabsContent value={NEW_TAB}>
          <PresetEditor
            preset={null}
            eventTypes={eventTypes}
            existingPresets={presets}
            onCreate={(data) => addPlanningPreset(data)}
            onUpdate={updatePlanningPreset}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
