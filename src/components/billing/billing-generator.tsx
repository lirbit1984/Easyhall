"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { FileText, Printer, CreditCard, Download, Loader2, Save } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeadsStore } from "@/store/use-leads-store";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { formatCurrency, formatDate, waLink, getEventTitle, primaryPhone, primaryContactName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { httpsCallable } from "firebase/functions";
import { elementToPdfBlob } from "@/lib/generate-pdf";
import { printElement } from "@/lib/print";
import { storage, functions, isFirebaseConfigured } from "@/lib/firebase/client";

const DEFAULT_VAT_PERCENT = 18;
const DEFAULT_DEPOSIT_PERCENT = 20;

type DocType = "quote" | "contract";

function getInitialLeadId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("leadId") ?? "";
}

export function BillingGenerator() {
  const router = useRouter();
  const role = useCurrentRole();
  const leads = useLeadsStore((s) => s.leads);
  const catalog = useLeadsStore((s) => s.catalog);
  const orgId = useLeadsStore((s) => s.orgId);
  const { orgDoc } = useOrgDoc();
  const addons = useMemo(() => catalog.filter((c) => c.active), [catalog]);
  const addDocument = useLeadsStore((s) => s.addDocument);
  const markDepositPaid = useLeadsStore((s) => s.markDepositPaid);
  const addSystemActivity = useLeadsStore((s) => s.addSystemActivity);
  const previewRef = useRef<HTMLDivElement>(null);
  const [generatingAction, setGeneratingAction] = useState<"save" | "send" | "download" | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ name: string; url: string } | null>(null);

  const [initialLeadId] = useState(getInitialLeadId);
  const initialLead = leads.find((l) => l.lead_id === initialLeadId);

  const [leadId, setLeadId] = useState(initialLeadId);
  const [docType, setDocType] = useState<DocType>("quote");
  const [guests, setGuests] = useState(initialLead?.estimated_guests ?? 0);
  const [pricePerPlate, setPricePerPlate] = useState(initialLead?.price_per_plate ?? 0);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [vatPercent, setVatPercent] = useState(DEFAULT_VAT_PERCENT);
  const [depositMode, setDepositMode] = useState<"percent" | "fixed">("percent");
  const [depositPercent, setDepositPercent] = useState(DEFAULT_DEPOSIT_PERCENT);
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentLinkCreated, setPaymentLinkCreated] = useState(false);

  // ברירות המחדל של מע"מ/מקדמה נטענות פעם אחת מהגדרות הארגון כשהן מגיעות;
  // אחרי זה המשתמש חופשי לשנות אותן להצעה הספציפית בלי שיידרסו מחדש.
  const [orgDefaultsApplied, setOrgDefaultsApplied] = useState(false);
  useEffect(() => {
    if (!orgDoc || orgDefaultsApplied) return;
    Promise.resolve().then(() => {
      setVatPercent(orgDoc.vatPercent ?? DEFAULT_VAT_PERCENT);
      setDepositMode(orgDoc.depositMode ?? "percent");
      setDepositPercent(orgDoc.depositPercent ?? DEFAULT_DEPOSIT_PERCENT);
      setDepositAmount(orgDoc.depositAmount ?? 0);
      setOrgDefaultsApplied(true);
    });
  }, [orgDoc, orgDefaultsApplied]);

  const lead = leads.find((l) => l.lead_id === leadId);

  const selectLead = (id: string) => {
    setLeadId(id);
    router.replace(`/billing?leadId=${id}`);
    const newLead = leads.find((l) => l.lead_id === id);
    if (newLead) {
      setGuests(newLead.estimated_guests);
      setPricePerPlate(newLead.price_per_plate);
      setPaymentLinkCreated(false);
      setSelectedAddons({});
    }
  };

  const calc = useMemo(() => {
    const baseTotal = guests * pricePerPlate;
    const addonsTotal = addons
      .filter((a) => selectedAddons[a.item_id])
      .reduce((sum, a) => sum + (a.unit === "per_guest" ? a.price * guests : a.price), 0);
    const subtotal = baseTotal + addonsTotal;
    const vatAmount = subtotal * (vatPercent / 100);
    const total = subtotal + vatAmount;
    const deposit = depositMode === "percent" ? total * (depositPercent / 100) : depositAmount;
    const remaining = total - deposit;
    const interim = remaining / 2;
    const final = remaining - interim;
    return { baseTotal, addonsTotal, subtotal, vatAmount, total, deposit, interim, final };
  }, [guests, pricePerPlate, addons, selectedAddons, vatPercent, depositMode, depositPercent, depositAmount]);

  // Generates a real PDF from the on-screen preview (rasterized — jsPDF has no
  // reliable Hebrew/RTL text shaping, so the styled HTML is captured as an image
  // instead). Uploads it to Firebase Storage when connected, scoped to this
  // org+lead, and records it in the lead's document library with a real URL.
  const generateAndStoreDocument = async (): Promise<string | null> => {
    if (!lead || !previewRef.current) return null;
    const docName = `${docType === "quote" ? "הצעת מחיר" : "חוזה התקשרות"} - ${getEventTitle(lead)}.pdf`;

    const blob = await elementToPdfBlob(previewRef.current);

    let url = "#";
    if (isFirebaseConfigured && storage && orgId) {
      const path = `organizations/${orgId}/leads/${lead.lead_id}/documents/${Date.now()}-${docName}`;
      const fileRef = storageRef(storage, path);
      // If the Storage bucket isn't provisioned yet, uploadBytes can hang
      // rather than reject — fail fast with a clear error instead of leaving
      // the button spinning forever.
      await Promise.race([
        uploadBytes(fileRef, blob, { contentType: "application/pdf" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("ההעלאה לאחסון נכשלה — ודאו ש-Firebase Storage מופעל")), 15000)
        ),
      ]);
      url = await getDownloadURL(fileRef);
    } else {
      // Demo mode / no org — no Storage to upload to, just hand the user the file.
      const localUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = localUrl;
      a.download = docName;
      a.click();
      URL.revokeObjectURL(localUrl);
    }

    addDocument(lead.lead_id, { name: docName, type: docType, url });
    return url;
  };

  const handleDownloadPdf = async () => {
    if (!lead) return;
    setGeneratingAction("download");
    try {
      const url = await generateAndStoreDocument();
      if (!url) {
        toast.error("לא ניתן היה להפיק את המסמך — נסה שוב");
        return;
      }
      if (url !== "#") {
        setViewingDoc({ name: `${docType === "quote" ? "הצעת מחיר" : "חוזה התקשרות"} - ${getEventTitle(lead)}.pdf`, url });
      }
      toast.success("המסמך הופק ונשמר בכרטיס הזוג");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהפקת המסמך");
    } finally {
      setGeneratingAction(null);
    }
  };

  const handleSaveOnly = async () => {
    if (!lead) return;
    setGeneratingAction("save");
    try {
      const url = await generateAndStoreDocument();
      if (!url) {
        toast.error("לא ניתן היה לשמור את המסמך");
        return;
      }
      toast.success("המסמך נשמר בכרטיס הזוג");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירת המסמך");
    } finally {
      setGeneratingAction(null);
    }
  };

  const handlePrint = () => {
    if (!previewRef.current) return;
    printElement(previewRef.current, "מסמך");
  };

  const handleSend = async () => {
    if (!lead) return;
    setGeneratingAction("send");
    try {
      const url = await generateAndStoreDocument();
      addSystemActivity(
        lead.lead_id,
        "whatsapp",
        `נשלחה ${docType === "quote" ? "הצעת מחיר" : "חוזה"} ב-WhatsApp ל${primaryContactName(lead)}.`
      );
      const linkLine = url && url !== "#" ? `\n${url}` : "";
      window.open(
        waLink(
          primaryPhone(lead),
          `שלום ${primaryContactName(lead)}, מצורפת ${docType === "quote" ? "הצעת המחיר" : "החוזה"} לאירוע שלכם בסך ${formatCurrency(
            calc.total
          )}.${linkLine}`
        ),
        "_blank",
        "noopener,noreferrer"
      );
      toast.success("המסמך נוצר ונשלח");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהפקת המסמך");
    } finally {
      setGeneratingAction(null);
    }
  };

  const handleCreatePaymentLink = async () => {
    if (!lead) return;

    // בלי Firebase (מצב דמו) — נשארת הסימולציה המקורית.
    if (!isFirebaseConfigured || !functions || !orgId) {
      markDepositPaid(lead.lead_id);
      setPaymentLinkCreated(true);
      toast.success('קישור לתשלום נוצר — הסטטוס עודכן ל"מקדמה שולמה"');
      return;
    }

    // מצב אמיתי: קישור Grow נוצר בשרת עם פרטי הסליקה של האולם. הסטטוס
    // "מקדמה שולמה" יתעדכן אוטומטית דרך ה-webhook רק כשהזוג ישלם בפועל.
    setCreatingLink(true);
    try {
      const createPaymentLink = httpsCallable(functions, "createPaymentLink");
      const result = await createPaymentLink({
        orgId,
        leadId: lead.lead_id,
        amountIls: Math.round(calc.deposit),
        description: `מקדמה לאירוע — ${getEventTitle(lead)}`,
      });
      const url = (result.data as { url: string }).url;
      setPaymentLinkCreated(true);
      window.open(
        waLink(
          primaryPhone(lead),
          `שלום ${primaryContactName(lead)}, להשלמת שריון התאריך — קישור לתשלום המקדמה (${formatCurrency(Math.round(calc.deposit))}):\n${url}`
        ),
        "_blank",
        "noopener,noreferrer"
      );
      toast.success("קישור התשלום נשלח ב-WhatsApp — הסטטוס יתעדכן אוטומטית כשהמקדמה תשולם");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה ביצירת קישור התשלום");
    } finally {
      setCreatingLink(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-2">
      {/* Form column */}
      <div className="grid gap-4">
        <Card className="p-4">
          <Label className="mb-1.5">בחר ליד / זוג</Label>
          <SearchableSelect
            value={leadId}
            onChange={selectLead}
            placeholder="חפש זוג..."
            searchPlaceholder="חיפוש לפי שם..."
            options={leads.map((l) => ({ value: l.lead_id, label: getEventTitle(l) }))}
          />
        </Card>

        {lead && (
          <>
            <Card className="grid gap-3 p-4">
              <h3 className="text-sm font-semibold">מחירון דינמי</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>כמות מוזמנים</Label>
                  <Input
                    type="number"
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>מחיר מנה (₪)</Label>
                  <Input
                    type="number"
                    value={pricePerPlate}
                    onChange={(e) => setPricePerPlate(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>תוספות ושדרוגים (ממאגר הפריטים)</Label>
                {addons.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    אין עדיין פריטים פעילים במאגר — ניתן להוסיף בהגדרות.
                  </p>
                )}
                {addons.map((a) => (
                  <label key={a.item_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={!!selectedAddons[a.item_id]}
                        onCheckedChange={(v) =>
                          setSelectedAddons((prev) => ({ ...prev, [a.item_id]: !!v }))
                        }
                      />
                      {a.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(a.price)} {a.unit === "per_guest" ? "/ אורח" : "(קבוע)"}
                    </span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>אחוז מע&quot;מ</Label>
                  <Input
                    type="number"
                    value={vatPercent}
                    onChange={(e) => setVatPercent(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-1.5">
                <Label>
                  מקדמה נדרשת
                  {role !== "admin" && (
                    <span className="mr-1 text-xs font-normal text-muted-foreground">
                      (לשינוי לסכום חריג יש לפנות למנהל)
                    </span>
                  )}
                </Label>
                {role === "admin" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex overflow-hidden rounded-md border border-border text-xs">
                      <button
                        type="button"
                        onClick={() => setDepositMode("percent")}
                        className={cn(
                          "px-3 py-2",
                          depositMode === "percent" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        אחוז
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositMode("fixed")}
                        className={cn(
                          "border-r border-border px-3 py-2",
                          depositMode === "fixed" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        סכום קבוע
                      </button>
                    </div>
                    {depositMode === "percent" ? (
                      <Input
                        type="number"
                        className="w-28"
                        value={depositPercent}
                        onChange={(e) => setDepositPercent(Number(e.target.value) || 0)}
                      />
                    ) : (
                      <Input
                        type="number"
                        className="w-32"
                        dir="ltr"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-sm">
                    {depositMode === "percent" ? `${depositPercent}% מסה"כ` : formatCurrency(depositAmount)}
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <Label className="mb-1.5">סוג מסמך</Label>
              <Tabs value={docType} onValueChange={(v) => v && setDocType(v as DocType)}>
                <TabsList className="w-full">
                  <TabsTrigger value="quote" className="flex-1">
                    הצעת מחיר
                  </TabsTrigger>
                  <TabsTrigger value="contract" className="flex-1">
                    חוזה התקשרות
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" className="gap-1.5" onClick={handleSaveOnly} disabled={generatingAction !== null}>
                  {generatingAction === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  שמור מסמך
                </Button>
                <Button className="gap-1.5" onClick={handleSend} disabled={generatingAction !== null}>
                  {generatingAction === "send" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <WhatsappIcon className="size-3.5" />
                  )}
                  שלח ב-WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleDownloadPdf}
                  disabled={generatingAction !== null}
                >
                  {generatingAction === "download" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  הורד PDF
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={handlePrint}>
                  <Printer className="size-3.5" />
                  הדפס
                </Button>
                <Button
                  variant={paymentLinkCreated ? "secondary" : "default"}
                  className="gap-1.5"
                  disabled={paymentLinkCreated || creatingLink}
                  onClick={handleCreatePaymentLink}
                >
                  {creatingLink ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CreditCard className="size-3.5" />
                  )}
                  {paymentLinkCreated ? "קישור לתשלום נוצר ✓" : "צור קישור לתשלום"}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Preview column */}
      <div>
        {!lead ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
            <div>
              <FileText className="mx-auto mb-2 size-8" />
              בחר ליד כדי להפיק תצוגה מקדימה של הצעת מחיר / חוזה
            </div>
          </div>
        ) : (
          <Card className="p-6 print:shadow-none" id="document-preview" dir="rtl">
            <div ref={previewRef} className="bg-white" dir="rtl">
            <div className="mb-4 flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold">EasyHall — אולם אירועים</h2>
                <p className="text-sm text-muted-foreground">
                  {docType === "quote" ? "הצעת מחיר" : "חוזה התקשרות"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(new Date().toISOString())}</p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">לכבוד: </span>
                {getEventTitle(lead)}
              </p>
              <p>
                <span className="text-muted-foreground">תאריך אירוע: </span>
                {formatDate(lead.event_date)}
              </p>
              <p>
                <span className="text-muted-foreground">טלפון: </span>
                {primaryPhone(lead)}
              </p>
              <p>
                <span className="text-muted-foreground">כמות מוזמנים: </span>
                {guests}
              </p>
            </div>

            <Separator className="my-3" />

            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-1.5">מנות ({guests} × {formatCurrency(pricePerPlate)})</td>
                  <td className="py-1.5 text-left">{formatCurrency(calc.baseTotal)}</td>
                </tr>
                {addons.filter((a) => selectedAddons[a.item_id]).map((a) => (
                  <tr key={a.item_id} className="border-b">
                    <td className="py-1.5">
                      {a.name} {a.unit === "per_guest" ? `(${guests} × ${formatCurrency(a.price)})` : "(קבוע)"}
                    </td>
                    <td className="py-1.5 text-left">
                      {formatCurrency(a.unit === "per_guest" ? a.price * guests : a.price)}
                    </td>
                  </tr>
                ))}
                <tr className="border-b">
                  <td className="py-1.5">סה&quot;כ לפני מע&quot;מ</td>
                  <td className="py-1.5 text-left">{formatCurrency(calc.subtotal)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5">מע&quot;מ ({vatPercent}%)</td>
                  <td className="py-1.5 text-left">{formatCurrency(calc.vatAmount)}</td>
                </tr>
                <tr className="border-b font-bold">
                  <td className="py-2">סה&quot;כ לתשלום (כולל מע&quot;מ)</td>
                  <td className="py-2 text-left">{formatCurrency(calc.total)}</td>
                </tr>
              </tbody>
            </table>

            <Separator className="my-3" />

            <h4 className="mb-2 text-sm font-semibold">לוח תשלומים מומלץ</h4>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-1.5">
                    מקדמה ({depositMode === "percent" ? `${depositPercent}%` : formatCurrency(depositAmount)})
                  </td>
                  <td className="py-1.5 text-left">{formatCurrency(calc.deposit)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1.5">תשלום ביניים</td>
                  <td className="py-1.5 text-left">{formatCurrency(calc.interim)}</td>
                </tr>
                <tr>
                  <td className="py-1.5">גמר חשבון</td>
                  <td className="py-1.5 text-left">{formatCurrency(calc.final)}</td>
                </tr>
              </tbody>
            </table>

            {docType === "contract" && (
              <p className="mt-4 text-xs text-muted-foreground">
                מסמך זה מהווה הסכם התקשרות מחייב בין הצדדים בכפוף לתנאי האולם המלאים.
              </p>
            )}
            </div>
          </Card>
        )}
      </div>

      <DocumentViewerDialog doc={viewingDoc} onOpenChange={(o) => !o && setViewingDoc(null)} />
    </div>
  );
}
