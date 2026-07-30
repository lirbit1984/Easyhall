"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Image as ImageIcon, MapPin, MessageSquareQuote, Plus, ScrollText, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

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

export function BrandingSettings() {
  const orgId = useLeadsStore((s) => s.orgId);
  const setOrgLogo = useLeadsStore((s) => s.setOrgLogo);
  const setOrgContractLegalText = useLeadsStore((s) => s.setOrgContractLegalText);
  const setOrgVenueDetails = useLeadsStore((s) => s.setOrgVenueDetails);
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const promisePresets = useLeadsStore((s) => s.promisePresets);
  const addPromisePreset = useLeadsStore((s) => s.addPromisePreset);
  const deletePromisePreset = useLeadsStore((s) => s.deletePromisePreset);
  const { orgDoc } = useOrgDoc();

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [contractDraft, setContractDraft] = useState(orgDoc?.contractLegalText ?? "");
  const [venueAddress, setVenueAddress] = useState(orgDoc?.venueAddress ?? "");
  const [venuePhone, setVenuePhone] = useState(orgDoc?.venuePhone ?? "");
  const [venueEmail, setVenueEmail] = useState(orgDoc?.venueEmail ?? "");
  const [presetEventType, setPresetEventType] = useState("");
  const [presetText, setPresetText] = useState("");

  useEffect(() => {
    if (!orgDoc) return;
    Promise.resolve().then(() => {
      setVenueAddress(orgDoc.venueAddress ?? "");
      setVenuePhone(orgDoc.venuePhone ?? "");
      setVenueEmail(orgDoc.venueEmail ?? "");
    });
  }, [orgDoc]);

  const saveVenueDetails = () => {
    setOrgVenueDetails({
      venueAddress: venueAddress.trim(),
      venuePhone: venuePhone.trim(),
      venueEmail: venueEmail.trim(),
    });
    toast.success("פרטי האולם עודכנו");
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isFirebaseConfigured || !storage || !orgId) return;
    setUploadingLogo(true);
    try {
      const path = `organizations/${orgId}/branding/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      setOrgLogo(url);
      toast.success("הלוגו הועלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהעלאת הלוגו");
    } finally {
      setUploadingLogo(false);
    }
  };

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
    <div className="grid gap-3.5">
      <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <ImageIcon className="size-4 text-muted-foreground" />
          <h2 className="text-base">לוגו האולם</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          מוצג בכותרת הצעות המחיר והחוזים שמופקים מכרטיסי האירוע.
        </p>
        <div className="flex items-center gap-3">
          {orgDoc?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgDoc.logoUrl} alt="לוגו האולם" className="size-14 rounded-md border border-border object-contain" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              אין לוגו
            </div>
          )}
          <label
            className={cn(
              buttonVariants({ variant: "outline" }),
              "cursor-pointer",
              uploadingLogo && "pointer-events-none opacity-50"
            )}
          >
            <input type="file" accept="image/*" className="sr-only" disabled={uploadingLogo} onChange={handleLogoChange} />
            {uploadingLogo ? "מעלה..." : orgDoc?.logoUrl ? "החלף לוגו" : "העלה לוגו"}
          </label>
        </div>
      </BlueprintBox>

      <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <h2 className="text-base">פרטי האולם</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          מוצגים בשורה התחתונה של הצעות המחיר והחוזים שמופקים מכרטיסי האירוע.
        </p>
        <div className="grid gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="venue_address">כתובת</Label>
            <Input id="venue_address" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="venue_phone">טלפון</Label>
              <Input id="venue_phone" dir="ltr" value={venuePhone} onChange={(e) => setVenuePhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="venue_email">אימייל</Label>
              <Input id="venue_email" type="email" dir="ltr" value={venueEmail} onChange={(e) => setVenueEmail(e.target.value)} />
            </div>
          </div>
          <Button className="w-fit" onClick={saveVenueDetails}>
            שמור פרטי אולם
          </Button>
        </div>
      </BlueprintBox>

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
    </div>
  );
}
