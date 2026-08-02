"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { PLANNING_SECTION_KEYS, PLANNING_SECTION_LABELS } from "@/lib/types";
import type { PlanningSectionKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_EVENT_TYPE = "__none__";

/**
 * פריסטים לטופס תכנון האירוע: אילו כרטיסיות מוצגות לכל סוג אירוע (ברית לא
 * צריכה סדר חופה, אירוע חברה לא צריך בקשות כשרות). שיוך לסוג אירוע הוא מה
 * שמאפשר לטופס להיפתח מוכן בלי בחירה ידנית של מנהל האירוע.
 */
export function PlanningPresetsSettings() {
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const presets = useLeadsStore((s) => s.planningPresets);
  const addPlanningPreset = useLeadsStore((s) => s.addPlanningPreset);
  const updatePlanningPreset = useLeadsStore((s) => s.updatePlanningPreset);
  const deletePlanningPreset = useLeadsStore((s) => s.deletePlanningPreset);

  const [name, setName] = useState("");
  const [eventTypeId, setEventTypeId] = useState(NO_EVENT_TYPE);
  const [sections, setSections] = useState<PlanningSectionKey[]>([...PLANNING_SECTION_KEYS]);

  const toggleSection = (key: PlanningSectionKey) =>
    setSections((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const submit = () => {
    if (!name.trim()) {
      toast.error("שם הפריסט הוא שדה חובה");
      return;
    }
    if (sections.length === 0) {
      toast.error("יש לבחור לפחות כרטיסייה אחת");
      return;
    }
    const resolvedEventTypeId = eventTypeId === NO_EVENT_TYPE ? null : eventTypeId;
    const clashing = resolvedEventTypeId
      ? presets.find((p) => p.event_type_id === resolvedEventTypeId)
      : undefined;
    addPlanningPreset({
      name: name.trim(),
      event_type_id: resolvedEventTypeId,
      sections,
    });
    setName("");
    setEventTypeId(NO_EVENT_TYPE);
    setSections([...PLANNING_SECTION_KEYS]);
    if (clashing) {
      toast.warning(
        `הפריסט נוסף, אבל "${clashing.name}" כבר משויך לאותו סוג אירוע — רק הראשון ברשימה ייטען אוטומטית`
      );
    } else {
      toast.success("הפריסט נוסף");
    }
  };

  return (
    <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <ClipboardList className="size-4 text-muted-foreground" />
        <h2 className="text-base">פריסטים לתכנון אירוע</h2>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        קובעים אילו כרטיסיות מופיעות בטאב &quot;תכנון האירוע&quot; לכל סוג אירוע — לברית או לאירוע חברה אין
        צורך בסדר חופה, לדוגמה. פריסט המשויך לסוג אירוע נטען אוטומטית; ליד עם סוג ללא שיוך יציע בחירה ידנית.
      </p>

      <div className="grid gap-2.5 rounded-lg border border-border p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="preset_name">שם הפריסט</Label>
            <Input id="preset_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="חתונה" />
          </div>
          <div className="grid gap-1.5">
            <Label>שיוך אוטומטי לסוג אירוע</Label>
            <Select value={eventTypeId} onValueChange={(v) => v && setEventTypeId(v)}>
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

        <Button className="w-fit gap-1.5" onClick={submit}>
          <Plus className="size-3.5" />
          הוסף פריסט
        </Button>
      </div>

      <div className="mt-3 grid gap-1.5">
        {presets.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין פריסטים.</p>}
        {presets.map((p) => {
          const linkedType = eventTypes.find((t) => t.event_type_id === p.event_type_id);
          return (
            <div key={p.preset_id} className="border-t border-border py-2.5 text-sm first:border-t-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {linkedType ? `משויך לסוג אירוע: ${linkedType.name}` : "ללא שיוך — בחירה ידנית"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  aria-label="מחיקה"
                  onClick={() => deletePlanningPreset(p.preset_id)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PLANNING_SECTION_KEYS.map((key) => {
                  const on = p.sections.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        updatePlanningPreset(p.preset_id, {
                          sections: on ? p.sections.filter((k) => k !== key) : [...p.sections, key],
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
                      {PLANNING_SECTION_LABELS[key]}
                    </button>
                  );
                })}
              </div>
              {linkedType && (
                <div className="mt-1.5">
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    שיוך אוטומטי
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BlueprintBox>
  );
}
