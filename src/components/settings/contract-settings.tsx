"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { FileText, MessageSquareQuote, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import type { PromisePreset } from "@/lib/types";

const ALL_EVENT_TYPES = "__all__";

const DEFAULT_CONTRACT_TEXT = `1. כללי
האמור בהסכם זה משקף את כל ההסכמות בין הצדדים. לא יהיה תוקף לשום הבטחה של נציג מכירות שלא באה לידי ביטוי מפורש ובכתב בהסכם זה.

2. תמורה ובטחונות
המזמין ימסור בטחונות (המחאות) בסך 110% משווי האירוע לא יאוחר מ-7 ימים ממועד חתימת ההסכם. גמר חשבון יבוצע לא יאוחר מ-72 שעות ממועד סיום האירוע. שינוי בכמות המוזמנים עשוי להשפיע על מחיר המנה.

3. נותני שירות חיצוניים
המזמין רשאי להזמין נותני שירות חיצוניים באחריותו הבלעדית, בכפוף לכללי האולם. תאורה, הגברה, בר ועיצוב ניתנים על ידי ספקי האולם אלא אם סוכם אחרת.

4. שעות האירוע
משך האירוע ושעות הפעילות ייקבעו מראש; חריגה משעות אלה תחויב בתשלום נוסף לפי מחירון האולם.

5. ביטוח וכוח עליון
האולם מבוטח בביטוח מתאים. במקרה כוח עליון שמונע את קיום האירוע ייקבע מועד חדש בתיאום בין הצדדים.

6. ביטול אירוע
ביטול אירוע על ידי המזמין כרוך בדמי ביטול מדורגים בהתאם למועד הביטול ביחס למועד האירוע, כפי שיפורט בנספח המחירון.

7. שונות
איסור עישון בשטח האולם; האולם רשאי לעשות שימוש בתיעוד מהאירוע לצרכי שיווק; אין להפעיל זיקוקים ללא היתר בכתב מרשויות הכיבוי.

8. הסכמה מדעת
המזמין מצהיר כי קרא הסכם זה על כל סעיפיו והוא מסכים לאמור בו.`;

/** נוסח משפטי לחוזה + פריסטים לטקסט הבטחות — לוגו ופרטי האולם עברו לטאב "כללי". */
export function ContractSettings() {
  const orgId = useLeadsStore((s) => s.orgId);
  const setOrgContractLegalText = useLeadsStore((s) => s.setOrgContractLegalText);
  const addOrgContractFile = useLeadsStore((s) => s.addOrgContractFile);
  const removeOrgContractFile = useLeadsStore((s) => s.removeOrgContractFile);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const promisePresets = useLeadsStore((s) => s.promisePresets);
  const addPromisePreset = useLeadsStore((s) => s.addPromisePreset);
  const deletePromisePreset = useLeadsStore((s) => s.deletePromisePreset);
  const { orgDoc } = useOrgDoc();

  const updatePromisePreset = useLeadsStore((s) => s.updatePromisePreset);
  const [contractDraft, setContractDraft] = useState(orgDoc?.contractLegalText ?? "");
  const [presetEventTypes, setPresetEventTypes] = useState<string[]>([]);
  const [presetText, setPresetText] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editEventTypes, setEditEventTypes] = useState<string[]>([]);
  const [editText, setEditText] = useState("");
  const [uploadingContractFile, setUploadingContractFile] = useState(false);
  const [newFileEventType, setNewFileEventType] = useState(ALL_EVENT_TYPES);

  useEffect(() => {
    if (!orgDoc) return;
    Promise.resolve().then(() => {
      setContractDraft(orgDoc.contractLegalText ?? "");
    });
  }, [orgDoc]);

  const saveContractText = () => {
    setOrgContractLegalText(contractDraft);
    toast.success("נוסח החוזה עודכן");
  };

  const useDefaultText = () => setContractDraft(DEFAULT_CONTRACT_TEXT);

  const handleContractFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isFirebaseConfigured || !storage || !orgId) return;
    setUploadingContractFile(true);
    try {
      const path = `organizations/${orgId}/contract/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      addOrgContractFile({
        id: crypto.randomUUID(),
        url,
        name: file.name,
        eventTypeId: newFileEventType === ALL_EVENT_TYPES ? null : newFileEventType,
      });
      toast.success("קובץ החוזה הועלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת קובץ החוזה");
    } finally {
      setUploadingContractFile(false);
    }
  };

  const submitPreset = () => {
    if (presetEventTypes.length === 0 || !presetText.trim()) {
      toast.error("יש לבחור לפחות סוג אירוע אחד ולהזין טקסט");
      return;
    }
    addPromisePreset(presetEventTypes, presetText.trim());
    setPresetText("");
    setPresetEventTypes([]);
    toast.success("הפריסט נוסף");
  };

  const togglePresetEventType = (name: string) =>
    setPresetEventTypes((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const startEditPreset = (p: PromisePreset) => {
    setEditingPresetId(p.preset_id);
    setEditEventTypes(p.event_type_names);
    setEditText(p.text);
  };

  const toggleEditEventType = (name: string) =>
    setEditEventTypes((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const saveEditPreset = () => {
    if (!editingPresetId) return;
    if (editEventTypes.length === 0 || !editText.trim()) {
      toast.error("יש לבחור לפחות סוג אירוע אחד ולהזין טקסט");
      return;
    }
    updatePromisePreset(editingPresetId, { event_type_names: editEventTypes, text: editText.trim() });
    setEditingPresetId(null);
    toast.success("הפריסט עודכן");
  };

  return (
    <Tabs defaultValue="text" className="min-h-[520px] gap-3.5">
      <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
        <TabsTrigger value="text" className="flex-none px-4 py-2.5">נוסח החוזה</TabsTrigger>
        <TabsTrigger value="promises" className="flex-none px-4 py-2.5">פריסטי הבטחות</TabsTrigger>
      </TabsList>

      <TabsContent value="text">
      <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <ScrollText className="size-4 text-muted-foreground" />
          <h2 className="text-base">נוסח משפטי לחוזה</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          מתווסף בתחתית החוזה (מעבר להצעת המחיר) כשמפיקים &quot;חוזה התקשרות&quot; מכרטיס אירוע.
        </p>
        <Textarea value={contractDraft} onChange={(e) => setContractDraft(e.target.value)} rows={12} className="font-mono text-xs" />
        <div className="mt-2 flex gap-2">
          <Button onClick={saveContractText}>שמור נוסח</Button>
          <Button variant="outline" onClick={useDefaultText}>
            טען נוסח ברירת מחדל
          </Button>
        </div>

        <Separator className="my-4" />

        <div className="mb-1 flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <h2 className="text-base">קבצי חוזה חלופיים לפי סוג אירוע</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          אפשר להעלות חוזה מוכן (PDF/Word) לכל סוג אירוע בנפרד — למשל נוסח שונה לאירוע עסקי לעומת
          פרטי. כשהאולם מפיק &quot;חוזה התקשרות&quot; מכרטיס אירוע, מוצעים הקבצים שמתאימים לסוג
          האירוע (וגם קבצים &quot;כלליים&quot;) לצירוף בנוסף להצעת המחיר המחושבת — שנשארת תמיד
          מבוססת על הפריטים והמחירים העדכניים באירוע.
        </p>

        <div className="grid gap-1.5">
          {(orgDoc?.contractFiles?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">לא הועלו קבצי חוזה חלופיים.</p>
          )}
          {orgDoc?.contractFiles?.map((f) => (
            <div key={f.id} className="flex items-center gap-2 border-t border-border py-2 first:border-t-0">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {f.eventTypeId ? eventTypes.find((t) => t.event_type_id === f.eventTypeId)?.name ?? "סוג אירוע" : "כל סוגי האירוע"}
                </p>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                  {f.name}
                </a>
              </div>
              <Button size="icon" variant="ghost" className="size-8" onClick={() => removeOrgContractFile(f)}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Separator className="my-3" />

        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground">הוספת קובץ חדש</Label>
          <Select value={newFileEventType} onValueChange={(v) => v && setNewFileEventType(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="כל סוגי האירוע">
                {(v: string) => eventTypes.find((t) => t.event_type_id === v)?.name ?? "כל סוגי האירוע"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_EVENT_TYPES}>כל סוגי האירוע</SelectItem>
              {eventTypes.map((t) => (
                <SelectItem key={t.event_type_id} value={t.event_type_id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-fit cursor-pointer",
              uploadingContractFile && "pointer-events-none opacity-50"
            )}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              disabled={uploadingContractFile}
              onChange={handleContractFileChange}
            />
            {uploadingContractFile ? "מעלה..." : "העלה קובץ"}
          </label>
        </div>
      </BlueprintBox>
      </TabsContent>

      <TabsContent value="promises">
      <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <MessageSquareQuote className="size-4 text-muted-foreground" />
          <h2 className="text-base">פריסטים לטקסט הבטחות לפי סוג אירוע</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          נציג בהצעת המחיר יכול לבחור פריסט מתאים לסוג האירוע וזה ימלא אוטומטית ניסוח קבוע.
        </p>

        <div className="grid gap-1.5">
          {promisePresets.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין פריסטים.</p>}
          {promisePresets.map((p) =>
            editingPresetId === p.preset_id ? (
              <div key={p.preset_id} className="grid gap-2 border-t border-border py-2 first:border-t-0">
                <div className="flex flex-wrap gap-1.5">
                  {eventTypes.map((t) => {
                    const on = editEventTypes.includes(t.name);
                    return (
                      <button
                        key={t.event_type_id}
                        type="button"
                        onClick={() => toggleEditEventType(t.name)}
                        aria-pressed={on}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          on
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                <div className="flex items-center gap-2">
                  <Button size="sm" className="w-fit" onClick={saveEditPreset}>
                    שמור
                  </Button>
                  <Button size="sm" variant="ghost" className="w-fit" onClick={() => setEditingPresetId(null)}>
                    ביטול
                  </Button>
                </div>
              </div>
            ) : (
              <div key={p.preset_id} className="flex items-start gap-2 border-t border-border py-2 first:border-t-0">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{p.event_type_names.join(", ")}</p>
                  <p className="text-sm">{p.text}</p>
                </div>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => startEditPreset(p)} aria-label="עריכת פריסט">
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => deletePromisePreset(p.preset_id)} aria-label="מחיקת פריסט">
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            )
          )}
        </div>

        <Separator className="my-3" />

        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground">הוספת פריסט חדש — שיוך לסוגי אירוע</Label>
          <div className="flex flex-wrap gap-1.5">
            {eventTypes.map((t) => {
              const on = presetEventTypes.includes(t.name);
              return (
                <button
                  key={t.event_type_id}
                  type="button"
                  onClick={() => togglePresetEventType(t.name)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
          <Textarea
            placeholder="הניסוח שיוצע לנציג עבור סוגי האירוע שנבחרו..."
            value={presetText}
            onChange={(e) => setPresetText(e.target.value)}
            rows={3}
          />
          <Button className="w-fit gap-1.5" onClick={submitPreset}>
            <Plus className="size-3.5" />
            הוסף פריסט
          </Button>
        </div>
      </BlueprintBox>
      </TabsContent>
    </Tabs>
  );
}
