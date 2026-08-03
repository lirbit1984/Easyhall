"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Image as ImageIcon, MapPin, Bell, Tags, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BlueprintBox } from "@/components/layout/blueprint-box";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { LEAD_SOURCES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function GeneralSettings() {
  const orgId = useLeadsStore((s) => s.orgId);
  const setOrgLogo = useLeadsStore((s) => s.setOrgLogo);
  const setOrgVenueDetails = useLeadsStore((s) => s.setOrgVenueDetails);
  const setOrgLeadSources = useLeadsStore((s) => s.setOrgLeadSources);
  const { orgDoc } = useOrgDoc();

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hallName, setHallName] = useState(orgDoc?.name ?? "");
  const [companyId, setCompanyId] = useState(orgDoc?.companyId ?? "");
  const [website, setWebsite] = useState(orgDoc?.website ?? "");
  const [venueAddress, setVenueAddress] = useState(orgDoc?.venueAddress ?? "");
  const [venuePhone, setVenuePhone] = useState(orgDoc?.venuePhone ?? "");
  const [venueEmail, setVenueEmail] = useState(orgDoc?.venueEmail ?? "");
  const [senderEmail, setSenderEmail] = useState(orgDoc?.senderEmail ?? "");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [sourceDraft, setSourceDraft] = useState("");
  const [sources, setSources] = useState<string[]>(LEAD_SOURCES);

  useEffect(() => {
    if (!orgDoc) return;
    Promise.resolve().then(() => {
      setHallName(orgDoc.name ?? "");
      setCompanyId(orgDoc.companyId ?? "");
      setWebsite(orgDoc.website ?? "");
      setVenueAddress(orgDoc.venueAddress ?? "");
      setVenuePhone(orgDoc.venuePhone ?? "");
      setVenueEmail(orgDoc.venueEmail ?? "");
      setSenderEmail(orgDoc.senderEmail ?? "");
      setNotifyEmail(!!orgDoc.notifyNewLeadEmail);
      setNotifyWhatsapp(!!orgDoc.notifyNewLeadWhatsapp);
      setSources(orgDoc.leadSources && orgDoc.leadSources.length > 0 ? orgDoc.leadSources : LEAD_SOURCES);
    });
  }, [orgDoc]);

  const saveVenueDetails = () => {
    setOrgVenueDetails({
      name: hallName.trim(),
      companyId: companyId.trim(),
      website: website.trim(),
      venueAddress: venueAddress.trim(),
      venuePhone: venuePhone.trim(),
      venueEmail: venueEmail.trim(),
      senderEmail: senderEmail.trim(),
    });
    toast.success("פרטי האולם עודכנו");
  };

  const saveNotifications = (email: boolean, whatsapp: boolean) => {
    setNotifyEmail(email);
    setNotifyWhatsapp(whatsapp);
    setOrgVenueDetails({ notifyNewLeadEmail: email, notifyNewLeadWhatsapp: whatsapp });
  };

  const addSource = () => {
    const name = sourceDraft.trim();
    if (!name) return;
    if (sources.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" כבר קיים ברשימה`);
      return;
    }
    const next = [...sources, name];
    setSources(next);
    setOrgLeadSources(next);
    setSourceDraft("");
  };

  const removeSource = (name: string) => {
    const next = sources.filter((s) => s !== name);
    setSources(next);
    setOrgLeadSources(next);
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

  return (
    <Tabs defaultValue="venue" className="gap-3.5">
      <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
        <TabsTrigger value="venue" className="flex-none px-4 py-2.5">פרטי אולם</TabsTrigger>
        <TabsTrigger value="notifications" className="flex-none px-4 py-2.5">התראות ומקורות ליד</TabsTrigger>
      </TabsList>

      <TabsContent value="venue" className="grid gap-3.5">
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
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="hall_name">שם האולם</Label>
              <Input id="hall_name" value={hallName} onChange={(e) => setHallName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="company_id">ח.פ / עוסק מורשה</Label>
              <Input id="company_id" dir="ltr" value={companyId} onChange={(e) => setCompanyId(e.target.value)} />
            </div>
          </div>
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
          <div className="grid gap-1.5">
            <Label htmlFor="website">אתר אינטרנט</Label>
            <Input id="website" dir="ltr" placeholder="https://" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sender_email">חשבון Gmail לשליחת מסמכים</Label>
            <Input
              id="sender_email"
              dir="ltr"
              placeholder="1"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              רלוונטי רק אם אתה מחובר לכמה חשבונות גוגל בו-זמנית. אחרת גוגל פותח את חשבון ברירת המחדל,
              שלא בהכרח החשבון שממנו אתה רוצה לשלוח לזוגות.
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">מומלץ להזין מספר חשבון</span> ולא כתובת: פתח את Gmail בחשבון
              שממנו אתה רוצה לשלוח, והסתכל בסרגל הכתובות — יופיע שם
              <span dir="ltr"> mail.google.com/mail/u/<span className="font-medium">N</span>/</span>. המספר
              הזה הוא מה שצריך להזין כאן. כתובת מייל גם תעבוד, אבל גוגל לפעמים מתעלם ממנה וחוזר לחשבון
              ברירת המחדל.
            </p>
          </div>
          <Button className="w-fit" onClick={saveVenueDetails}>
            שמור פרטי אולם
          </Button>
        </div>
      </BlueprintBox>
      </TabsContent>

      <TabsContent value="notifications" className="grid gap-3.5">
      <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-base">התראות</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          קבלת התראה כשנכנס ליד חדש. שליחת ההתראות בפועל תיפתח יחד עם טאב &quot;אינטגרציות&quot; —
          כרגע ההעדפה נשמרת ומוכנה לחיבור.
        </p>
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notifyEmail} onCheckedChange={(v) => saveNotifications(!!v, notifyWhatsapp)} />
            התראת מייל על ליד חדש
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notifyWhatsapp} onCheckedChange={(v) => saveNotifications(notifyEmail, !!v)} />
            התראת וואטסאפ על ליד חדש
          </label>
        </div>
      </BlueprintBox>

      <BlueprintBox className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <Tags className="size-4 text-muted-foreground" />
          <h2 className="text-base">מקורות ליד</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          הרשימה שמוצעת בטופס &quot;ליד חדש&quot; לבחירת מקור הפנייה.
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"
            >
              {s}
              <button type="button" onClick={() => removeSource(s)} aria-label={`הסר ${s}`}>
                <Trash2 className="size-3 text-destructive" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="מקור חדש"
            value={sourceDraft}
            onChange={(e) => setSourceDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSource()}
            className="h-8 max-w-56"
          />
          <Button size="sm" className="h-8 gap-1.5" onClick={addSource}>
            <Plus className="size-3.5" />
            הוסף
          </Button>
        </div>
      </BlueprintBox>
      </TabsContent>
    </Tabs>
  );
}
