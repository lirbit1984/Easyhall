"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquareQuote, Plus, ScrollText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";

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
  const setOrgContractLegalText = useLeadsStore((s) => s.setOrgContractLegalText);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const promisePresets = useLeadsStore((s) => s.promisePresets);
  const addPromisePreset = useLeadsStore((s) => s.addPromisePreset);
  const deletePromisePreset = useLeadsStore((s) => s.deletePromisePreset);
  const { orgDoc } = useOrgDoc();

  const [contractDraft, setContractDraft] = useState(orgDoc?.contractLegalText ?? "");
  const [presetEventType, setPresetEventType] = useState("");
  const [presetText, setPresetText] = useState("");

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

  const submitPreset = () => {
    if (!presetEventType.trim() || !presetText.trim()) {
      toast.error("יש לבחור סוג אירוע ולהזין טקסט");
      return;
    }
    addPromisePreset(presetEventType.trim(), presetText.trim());
    setPresetText("");
    setPresetEventType("");
    toast.success("הפריסט נוסף");
  };

  return (
    <Tabs defaultValue="text" className="gap-3.5">
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
          {promisePresets.map((p) => (
            <div key={p.preset_id} className="flex items-start gap-2 border-t border-border py-2 first:border-t-0">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">{p.event_type_name}</p>
                <p className="text-sm">{p.text}</p>
              </div>
              <Button size="icon" variant="ghost" className="size-8" onClick={() => deletePromisePreset(p.preset_id)}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Separator className="my-3" />

        <div className="grid gap-2">
          <Label className="text-xs text-muted-foreground">הוספת פריסט חדש</Label>
          <Select value={presetEventType} onValueChange={(v) => v && setPresetEventType(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="בחר סוג אירוע">
                {(v: string) => eventTypes.find((t) => t.name === v)?.name ?? v}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((t) => (
                <SelectItem key={t.event_type_id} value={t.name}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="הניסוח שיוצע לנציג עבור סוג האירוע הזה..."
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
