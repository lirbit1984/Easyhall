"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Download, Loader2, Plus, Printer, Save, X, Info, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { useOrg } from "@/lib/firebase/org-context";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { elementToPdfBlob } from "@/lib/generate-pdf";
import { printElement } from "@/lib/print";
import {
  formatCurrency,
  formatDate,
  getEventTitle,
  primaryContactName,
  primaryPhone,
  waLink,
} from "@/lib/format";
import { getRoleLabel, EVENT_DAY_PART_LABELS } from "@/lib/types";
import type { LeadEvent, QuoteOptionalDate, LeadPaymentStep, PaymentTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

function resolvePaymentStepsFromTemplate(
  template: PaymentTemplate,
  totalAmount: number,
  eventDate: string | null
): LeadPaymentStep[] {
  const eventDateObj = eventDate ? new Date(eventDate) : null;
  const today = new Date().toISOString().slice(0, 10);
  return template.steps.map((s) => {
    const amount = Math.round(s.amount_type === "percent" ? totalAmount * (s.amount_value / 100) : s.amount_value);
    let due_date = today;
    if (s.timing_type !== "on_signing" && eventDateObj) {
      const d = new Date(eventDateObj);
      const days = s.timing_days ?? 0;
      d.setDate(d.getDate() + (s.timing_type === "before_event" ? -days : days));
      due_date = d.toISOString().slice(0, 10);
    }
    return {
      step_id: crypto.randomUUID(),
      label: s.label,
      amount,
      due_date,
      is_paid: false,
    };
  });
}

export interface QuoteItem {
  item_id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatMode: "plus_vat" | "included";
}

function newDateRow(date = ""): QuoteOptionalDate {
  return { date_id: crypto.randomUUID(), date, price_overrides: {} };
}

function lineTotals(unitPrice: number, quantity: number, vatMode: "plus_vat" | "included", vatPercent: number) {
  const subtotal = unitPrice * quantity;
  const vat = vatMode === "included" ? subtotal * (vatPercent / (100 + vatPercent)) : subtotal * (vatPercent / 100);
  const total = vatMode === "included" ? subtotal : subtotal + vat;
  return { vat, total };
}

export function CartQuoteDialog({
  lead,
  items,
  vatPercent,
  open,
  onOpenChange,
  initialDocType = "quote",
}: {
  lead: LeadEvent;
  items: QuoteItem[];
  vatPercent: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDocType?: "quote" | "contract";
}) {
  const orgId = useLeadsStore((s) => s.orgId);
  const { orgDoc } = useOrgDoc();
  const { profile } = useOrg();
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const promisePresets = useLeadsStore((s) => s.promisePresets);
  const addPromisePreset = useLeadsStore((s) => s.addPromisePreset);
  const setPromises = useLeadsStore((s) => s.setPromises);
  const setLeadQuoteOptionalDates = useLeadsStore((s) => s.setLeadQuoteOptionalDates);
  const paymentTemplates = useLeadsStore((s) => s.paymentTemplates);
  const setLeadPaymentSchedule = useLeadsStore((s) => s.setLeadPaymentSchedule);
  const addDocument = useLeadsStore((s) => s.addDocument);
  const addSystemActivity = useLeadsStore((s) => s.addSystemActivity);

  const previewRef = useRef<HTMLDivElement>(null);
  const [docType, setDocType] = useState<"quote" | "contract">(initialDocType);
  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => setDocType(initialDocType));
  }, [open, initialDocType]);
  const [dates, setDates] = useState<QuoteOptionalDate[]>(
    lead.quote_optional_dates?.length ? lead.quote_optional_dates : [newDateRow(lead.event_date ?? "")]
  );
  const [promisesDraft, setPromisesDraft] = useState(lead.promises ?? "");
  const [paymentSteps, setPaymentSteps] = useState<LeadPaymentStep[]>(lead.payment_schedule ?? []);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [generatingAction, setGeneratingAction] = useState<"save" | "send" | "download" | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ name: string; url: string } | null>(null);
  // בזמן ייצוא (הדפסה/PDF) מציגים את מחירי התאריכים כטקסט קבוע במקום שדה
  // עריכה — Tailwind's print:hidden לא חל בכלל בנתיב ה-PDF (רסטור של ה-DOM
  // החי, לא דרך @media print), ואפילו בהדפסה עצמה זה תלוי בטעינת ה-stylesheet
  // הנכון ברגע הנכון. שליטה ב-state היא הדרך היחידה שעובדת בוודאות בשני הנתיבים.
  const [isExporting, setIsExporting] = useState(false);

  const waitForRepaint = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  // הלוגו נטען כ-data URL לפני שהוא נכנס ל-DOM (לא תמונת remote חיה): כשה-
  // תצוגה נרשמת ל-PNG לצורך PDF, תמונה שנטענה cross-origin ישירות "מכתימה"
  // את ה-canvas ומפילה את כל הפעולה (גם הורדה וגם שליחה בוואטסאפ) עם שגיאה
  // סתומה. המרה מראש ל-data URL עוקפת את זה לגמרי.
  useEffect(() => {
    let cancelled = false;
    if (!orgDoc?.logoUrl) {
      Promise.resolve().then(() => {
        if (!cancelled) setLogoDataUrl(null);
      });
      return () => {
        cancelled = true;
      };
    }
    fetch(orgDoc.logoUrl)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          })
      )
      .then((dataUrl) => {
        if (!cancelled) setLogoDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setLogoDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orgDoc?.logoUrl]);

  const eventTypeName = eventTypes.find((t) => t.event_type_id === lead.event_type_id)?.name ?? "";
  const matchingPresets = promisePresets.filter((p) => p.event_type_names.includes(eventTypeName));
  const applicableContractFiles = (orgDoc?.contractFiles ?? []).filter(
    (f) => f.eventTypeId === null || f.eventTypeId === lead.event_type_id
  );
  // בחוזה תאריך האירוע כבר סגור (נקבע בסגירת האירוע) — אין טעם בכמה תאריכים
  // מועמדים, ולכן תמיד מוצג במצב "תאריך יחיד" ולא ניתן לעריכה שם.
  const multiDate = docType === "quote" && dates.length > 1;
  // ככל שיש יותר תאריכים, הטבלה מצטופפת — מקטינים את הפונט כדי שכל
  // התאריכים והמחירים ישמרו על מרווחים קריאים בלי לגלוש.
  const tableTextClass =
    dates.length >= 5 ? "text-[10px]" : dates.length >= 4 ? "text-[11px]" : dates.length >= 3 ? "text-xs" : "text-sm";

  const addDateRow = () =>
    setDates((prev) => [...prev, newDateRow(new Date().toISOString().slice(0, 10))]);
  const removeDateRow = (id: string) => setDates((prev) => prev.filter((d) => d.date_id !== id));
  const updateDateValue = (id: string, date: string) =>
    setDates((prev) => prev.map((d) => (d.date_id === id ? { ...d, date } : d)));
  const updatePriceOverride = (dateId: string, itemId: string, value: string) =>
    setDates((prev) =>
      prev.map((d) => {
        if (d.date_id !== dateId) return d;
        const next = { ...d.price_overrides };
        if (value === "") delete next[itemId];
        else next[itemId] = Number(value);
        return { ...d, price_overrides: next };
      })
    );
  const priceFor = (dateId: string, item: QuoteItem) => {
    const override = dates.find((d) => d.date_id === dateId)?.price_overrides?.[item.item_id];
    return override ?? item.unitPrice;
  };
  const saveDates = () => {
    setLeadQuoteOptionalDates(lead.lead_id, dates);
    toast.success("התאריכים נשמרו על גבי כרטיס האירוע");
  };

  const totalsForDate = (dateId?: string) =>
    items.reduce(
      (acc, item) => {
        const price = dateId ? priceFor(dateId, item) : item.unitPrice;
        const { vat, total } = lineTotals(price, item.quantity, item.vatMode, vatPercent);
        return { vat: acc.vat + vat, total: acc.total + total };
      },
      { vat: 0, total: 0 }
    );

  const applyTemplate = (templateId: string) => {
    const template = paymentTemplates.find((t) => t.template_id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setPaymentSteps(resolvePaymentStepsFromTemplate(template, totalsForDate().total, lead.event_date ?? null));
  };
  // עריכת סכום בכל שלב מלבד האחרון "מגלגלת" את ההפרש אוטומטית לשלב האחרון,
  // כדי שסכום כל השלבים תמיד יישאר שווה לסה"כ העגלה — השלב האחרון הוא תמיד
  // ה"יתרה", לא נערך ישירות.
  const updatePaymentStep = (stepId: string, updates: Partial<LeadPaymentStep>) =>
    setPaymentSteps((prev) => {
      const next = prev.map((s) => (s.step_id === stepId ? { ...s, ...updates } : s));
      if (updates.amount === undefined || next.length < 2) return next;
      const lastIndex = next.length - 1;
      if (next[lastIndex].step_id === stepId) return next;
      const total = totalsForDate().total;
      const othersSum = next.slice(0, lastIndex).reduce((sum, s) => sum + s.amount, 0);
      next[lastIndex] = { ...next[lastIndex], amount: Math.round((total - othersSum) * 100) / 100 };
      return next;
    });
  const removePaymentStep = (stepId: string) =>
    setPaymentSteps((prev) => prev.filter((s) => s.step_id !== stepId));
  const addPaymentStep = () =>
    setPaymentSteps((prev) => [
      ...prev,
      { step_id: crypto.randomUUID(), label: "", amount: 0, due_date: new Date().toISOString().slice(0, 10), is_paid: false },
    ]);
  const savePaymentSchedule = () => {
    setLeadPaymentSchedule(lead.lead_id, paymentSteps);
    toast.success("לוח התשלומים נשמר לכרטיס האירוע");
  };

  const applyPreset = (text: string) => setPromisesDraft(text);
  const savePromises = () => {
    setPromises(lead.lead_id, promisesDraft);
    toast.success("ההבטחות נשמרו");
  };
  const saveAsPreset = () => {
    if (!eventTypeName || !promisesDraft.trim()) {
      toast.error("אין סוג אירוע מזוהה או שאין טקסט לשמור");
      return;
    }
    addPromisePreset([eventTypeName], promisesDraft);
    toast.success(`נשמר כפריסט עבור "${eventTypeName}"`);
  };

  const docLabel = docType === "quote" ? "הצעת מחיר" : "חוזה התקשרות";

  const generateAndStore = async (): Promise<string | null> => {
    if (!previewRef.current) return null;
    setIsExporting(true);
    await waitForRepaint();
    try {
      const docName = `${docLabel} - ${getEventTitle(lead)}.pdf`;
      const blob = await elementToPdfBlob(previewRef.current);

      let url = "#";
      if (isFirebaseConfigured && storage && orgId) {
        const path = `organizations/${orgId}/leads/${lead.lead_id}/documents/${Date.now()}-${docName}`;
        const fileRef = storageRef(storage, path);
        await Promise.race([
          uploadBytes(fileRef, blob, { contentType: "application/pdf" }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("ההעלאה לאחסון נכשלה — ודאו ש-Firebase Storage מופעל")), 15000)
          ),
        ]);
        url = await getDownloadURL(fileRef);
      } else {
        const localUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = localUrl;
        a.download = docName;
        a.click();
        URL.revokeObjectURL(localUrl);
      }
      addDocument(lead.lead_id, { name: docName, type: docType, url });
      return url;
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setGeneratingAction("download");
    try {
      const url = await generateAndStore();
      if (!url) {
        toast.error("לא ניתן היה להפיק את המסמך");
        return;
      }
      if (url !== "#") setViewingDoc({ name: `${docLabel} - ${getEventTitle(lead)}.pdf`, url });
      toast.success("המסמך הופק ונשמר בכרטיס האירוע");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהפקת המסמך");
    } finally {
      setGeneratingAction(null);
    }
  };

  const handlePrint = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    await waitForRepaint();
    printElement(previewRef.current, docLabel);
    // ה-iframe מעתיק את outerHTML באופן סינכרוני עם קריאה זו, כך שבטוח
    // להחזיר את המצב הרגיל מיד אחרי — לא צריך לחכות לסיום ההדפסה בפועל.
    setIsExporting(false);
  };

  const handleSaveOnly = async () => {
    setGeneratingAction("save");
    try {
      const url = await generateAndStore();
      if (!url) {
        toast.error("לא ניתן היה לשמור את המסמך");
        return;
      }
      toast.success("המסמך נשמר בכרטיס האירוע");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בשמירת המסמך");
    } finally {
      setGeneratingAction(null);
    }
  };

  const handleSend = async () => {
    setGeneratingAction("send");
    try {
      const url = await generateAndStore();
      addSystemActivity(lead.lead_id, "whatsapp", `נשלחה ${docLabel} ב-WhatsApp ל${primaryContactName(lead)}.`);
      const linkLine = url && url !== "#" ? `\n${url}` : "";
      window.open(
        waLink(primaryPhone(lead), `שלום ${primaryContactName(lead)}, מצורפת ${docLabel} לאירוע שלכם.${linkLine}`),
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

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[90vh] grid-cols-1 items-start gap-4 overflow-y-auto sm:max-w-5xl lg:grid-cols-2">
        <DialogHeader className="lg:col-span-2">
          <DialogTitle>הצעת מחיר / חוזה — {getEventTitle(lead)}</DialogTitle>
        </DialogHeader>

        {/* עמודת בקרה */}
        <div className="grid gap-3.5 print:hidden">
          <Tabs value={docType} onValueChange={(v) => v && setDocType(v as "quote" | "contract")}>
            <TabsList className="w-full">
              <TabsTrigger value="quote" className="flex-1">
                הצעת מחיר
              </TabsTrigger>
              <TabsTrigger value="contract" className="flex-1">
                חוזה התקשרות
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-1.5">
            <Label className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                הבטחות והערות
                <Tooltip>
                  <TooltipTrigger render={<Info className="size-3.5 text-muted-foreground" />} />
                  <TooltipContent>יופיע במסמך המודפס מתחת לפרטי האורחים ולטבלת הפריטים</TooltipContent>
                </Tooltip>
              </span>
            </Label>
            {matchingPresets.length > 0 && (
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">פריסטים ל&quot;{eventTypeName}&quot;:</span>
                <div className="flex flex-wrap gap-1.5">
                  {matchingPresets.map((p) => (
                    <button
                      key={p.preset_id}
                      type="button"
                      onClick={() => applyPreset(p.text)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      {p.text.length > 24 ? `${p.text.slice(0, 24)}…` : p.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Textarea
              value={promisesDraft}
              onChange={(e) => setPromisesDraft(e.target.value)}
              rows={4}
              placeholder="הבטחות/הערות שיופיעו בהצעת המחיר..."
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={savePromises}>
                שמור להערות הכרטיס
              </Button>
              <Button size="sm" variant="ghost" onClick={saveAsPreset}>
                שמור כפריסט לסוג האירוע
              </Button>
            </div>
          </div>

          {docType === "contract" && (
            <>
              <Separator />
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1">
                  לוח תשלומים
                  <Tooltip>
                    <TooltipTrigger render={<Info className="size-3.5 text-muted-foreground" />} />
                    <TooltipContent>יופיע במסמך המודפס מתחת להבטחות והערות, מעל מלל החוזה</TooltipContent>
                  </Tooltip>
                </Label>
                {paymentTemplates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    אין עדיין תבניות — ניתן להגדיר בהגדרות &gt; מאגרים &gt; לוחות תשלום.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {paymentTemplates.map((t) => {
                      const selected = selectedTemplateId === t.template_id;
                      return (
                        <button
                          key={t.template_id}
                          type="button"
                          onClick={() => applyTemplate(t.template_id)}
                          className={cn(
                            "min-w-[110px] rounded-lg border p-2.5 text-center transition-colors",
                            selected
                              ? "border-2 border-primary bg-primary/5"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          <p className={cn("text-xs font-medium", selected && "text-primary")}>{t.name}</p>
                          <p className={cn("mt-0.5 text-[10.5px]", selected ? "text-primary/80" : "text-muted-foreground")}>
                            {t.steps.length} {t.steps.length === 1 ? "שלב" : "שלבים"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {paymentSteps.length > 0 && (
                  <div className="mt-1 grid gap-1.5">
                    {paymentSteps.map((step, i) => (
                      <div key={step.step_id} className="grid gap-2 rounded-md border border-border p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">שלב {i + 1}</span>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => removePaymentStep(step.step_id)}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label className="text-xs font-normal text-muted-foreground">תיאור</Label>
                            <Input
                              placeholder="למשל: מקדמה"
                              value={step.label}
                              onChange={(e) => updatePaymentStep(step.step_id, { label: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs font-normal text-muted-foreground">סכום (₪)</Label>
                            <Input
                              type="number"
                              dir="ltr"
                              value={step.amount}
                              onChange={(e) => updatePaymentStep(step.step_id, { amount: Number(e.target.value) || 0 })}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-2 grid gap-1">
                            <Label className="text-xs font-normal text-muted-foreground">מועד תשלום</Label>
                            <DateField
                              value={step.due_date}
                              onChange={(v) => updatePaymentStep(step.step_id, { due_date: v ?? "" })}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="w-fit gap-1.5" onClick={addPaymentStep}>
                    <Plus className="size-3.5" />
                    הוסף שלב
                  </Button>
                  {paymentSteps.length > 0 && (
                    <Button size="sm" onClick={savePaymentSchedule}>
                      שמור לוח תשלומים
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {docType === "contract" && applicableContractFiles.length > 0 && (
            <div className="grid gap-1.5 rounded-md border border-border p-2.5 text-sm">
              <span className="text-muted-foreground">קבצי חוזה חלופיים שהועלו לסוג האירוע הזה:</span>
              {applicableContractFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{f.name}</span>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    פתח קובץ
                  </a>
                </div>
              ))}
            </div>
          )}

          {docType === "quote" && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <Label className="mb-0">תאריכים אופציונליים</Label>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={addDateRow}>
                  <Plus className="size-3.5" />
                  הוסף תאריך
                </Button>
              </div>
              <div className="grid gap-1.5">
                {dates.map((d) => (
                  <div key={d.date_id} className="flex items-center gap-2">
                    <DateField
                      value={d.date}
                      onChange={(v) => updateDateValue(d.date_id, v)}
                      className="h-8 min-w-0 flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      onClick={() => removeDateRow(d.date_id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                עם יותר מתאריך אחד, אפשר לערוך את המחיר של כל פריט בטבלת התצוגה לכל תאריך בנפרד.
              </p>
              <Button size="sm" variant="outline" onClick={saveDates}>
                שמור תאריכים לכרטיס האירוע
              </Button>
            </>
          )}
        </div>

        {/* תצוגה מקדימה */}
        <div className="aurora-card p-0" id="document-preview" dir="rtl">
          <div ref={previewRef} className="bg-white p-6 text-black" dir="rtl">
            {/* בלוק זה נלכד גם ל-PDF (html-to-image toSvg, foreignObject) — שם
                flex gap לא תמיד מחושב נכון וגורם לילדים להיערם זה על זה, אז
                הפריסה כאן בכוונה block/מרווחי margin רגילים ולא flex gap. */}
            <div className="mb-4 border-b pb-4 text-center">
              {logoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoDataUrl} alt="" className="mx-auto h-24 w-24 object-contain" />
              )}
              <div className="mt-2">
                <h2 className="text-xl font-bold">{orgDoc?.name ?? "האולם"}</h2>
                <p className="text-sm text-muted-foreground">{docLabel}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{formatDate(new Date().toISOString())}</p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">לכבוד: </span>
                {getEventTitle(lead)}
              </p>
              <p>
                <span className="text-muted-foreground">טלפון: </span>
                {primaryPhone(lead)}
              </p>
              <p>
                <span className="text-muted-foreground">כמות מוזמנים: </span>
                {lead.estimated_guests}
              </p>
              {docType === "contract" ? (
                lead.event_date && (
                  <p className="col-span-2 whitespace-nowrap">
                    <span className="text-muted-foreground">תאריך אירוע: </span>
                    {formatDate(lead.event_date)}
                    {lead.event_day_part && ` · ${EVENT_DAY_PART_LABELS[lead.event_day_part]}`}
                    {lead.event_start_time && ` · ${lead.event_start_time}`}
                    {lead.event_end_time && `–${lead.event_end_time}`}
                  </p>
                )
              ) : (
                !multiDate &&
                dates[0]?.date && (
                  <p>
                    <span className="text-muted-foreground">תאריך אירוע: </span>
                    {formatDate(dates[0].date)}
                  </p>
                )
              )}
            </div>

            {lead.contacts.length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="grid gap-2 text-sm">
                  {lead.contacts.map((c) => (
                    <div key={c.contact_id} className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <p className="col-span-2 font-medium">
                        {getRoleLabel(c.role_key)}: {c.name}
                      </p>
                      {c.id_number && (
                        <p>
                          <span className="text-muted-foreground">ת.ז/ח.פ: </span>
                          {c.id_number}
                        </p>
                      )}
                      {c.phone && (
                        <p>
                          <span className="text-muted-foreground">טלפון: </span>
                          {c.phone}
                        </p>
                      )}
                      {c.address && (
                        <p className="col-span-2">
                          <span className="text-muted-foreground">כתובת: </span>
                          {c.address}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <Separator className="my-3" />

            <table className={cn("w-full", tableTextClass)}>
              <thead>
                <tr className="border-b text-right">
                  <th className="py-1.5 font-medium">פריט</th>
                  <th className="py-1.5 font-medium">כמות</th>
                  {multiDate ? (
                    dates.map((d, i) => (
                      <th key={d.date_id} className="py-1.5 font-medium whitespace-nowrap">
                        {d.date ? formatDate(d.date) : `תאריך ${i + 1}`}
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="py-1.5 font-medium">מחיר ליחידה</th>
                      <th className="py-1.5 font-medium">סה&quot;כ</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.item_id} className="border-b">
                    <td className="py-1.5">{item.name}</td>
                    <td className="py-1.5">{item.quantity}</td>
                    {multiDate ? (
                      dates.map((d) =>
                        isExporting ? (
                          <td key={d.date_id} className="py-1.5">
                            {formatCurrency(priceFor(d.date_id, item))}
                          </td>
                        ) : (
                          <td key={d.date_id} className="py-1.5">
                            <Input
                              type="number"
                              value={priceFor(d.date_id, item)}
                              onChange={(e) => updatePriceOverride(d.date_id, item.item_id, e.target.value)}
                              className={cn("h-7", tableTextClass, dates.length >= 4 ? "w-16" : "w-20")}
                            />
                          </td>
                        )
                      )
                    ) : (
                      <>
                        <td className="py-1.5">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-1.5">{formatCurrency(lineTotals(item.unitPrice, item.quantity, item.vatMode, vatPercent).total)}</td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className="border-b font-bold">
                  <td className="py-2" colSpan={2}>
                    סה&quot;כ לתשלום (כולל מע&quot;מ {vatPercent}%)
                  </td>
                  {multiDate ? (
                    dates.map((d) => (
                      <td key={d.date_id} className="py-2">
                        {formatCurrency(totalsForDate(d.date_id).total)}
                      </td>
                    ))
                  ) : (
                    <>
                      <td className="py-2" />
                      <td className="py-2">{formatCurrency(totalsForDate().total)}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>

            {promisesDraft && (
              <>
                <Separator className="my-3" />
                <p className="whitespace-pre-line text-sm break-inside-avoid">{promisesDraft}</p>
              </>
            )}

            {docType === "contract" && paymentSteps.length > 0 && (
              <>
                <Separator className="my-3" />
                <h4 className="mb-2 text-sm font-semibold">לוח תשלומים</h4>
                <table className="w-full text-sm">
                  <tbody>
                    {paymentSteps.map((step) => (
                      <tr key={step.step_id} className="border-b">
                        <td className="py-1.5">{step.label}</td>
                        <td className="py-1.5 text-muted-foreground">עד {formatDate(step.due_date)}</td>
                        <td className="py-1.5 text-left">{formatCurrency(step.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-black font-bold">
                      <td className="py-2" colSpan={2}>
                        סה&quot;כ
                      </td>
                      <td className="py-2 text-left">
                        {formatCurrency(paymentSteps.reduce((sum, s) => sum + s.amount, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {docType === "quote" && (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  {profile?.fullName ?? "נציג מכירות"}
                  {profile?.phone ? ` · ${profile.phone}` : ""}
                  {" · "}* הצעת המחיר תקפה ל-7 ימים
                </p>
              </>
            )}

            {docType === "contract" && (
              <>
                <Separator className="my-3" />
                <div className="whitespace-pre-line text-xs text-muted-foreground">
                  {orgDoc?.contractLegalText ?? "לא הוגדר נוסח חוזה — ניתן להגדיר בהגדרות > מיתוג וחוזה."}
                </div>
                <div className="mt-6 grid grid-cols-3 gap-4 text-xs break-inside-avoid">
                  <div className="border-t border-black pt-1 text-center">חתימת מזמין א׳</div>
                  <div className="border-t border-black pt-1 text-center">חתימת מזמין ב׳</div>
                  <div className="border-t border-black pt-1 text-center">חתימת נציג {orgDoc?.name ?? "האולם"}</div>
                </div>
              </>
            )}

            {(orgDoc?.venueAddress || orgDoc?.venuePhone || orgDoc?.venueEmail) && (
              <div className="mt-4 border-t border-black pt-2 text-center text-[10px] text-muted-foreground">
                {[orgDoc?.name, orgDoc?.venueAddress, orgDoc?.venuePhone, orgDoc?.venueEmail]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 print:hidden lg:col-span-2">
          <Button variant="outline" className="gap-1.5" onClick={handleSaveOnly} disabled={generatingAction !== null}>
            {generatingAction === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            שמור מסמך
          </Button>
          <Button className="gap-1.5" onClick={handleSend} disabled={generatingAction !== null}>
            {generatingAction === "send" ? <Loader2 className="size-3.5 animate-spin" /> : <WhatsappIcon className="size-3.5" />}
            שלח ב-WhatsApp
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={handleDownloadPdf} disabled={generatingAction !== null}>
            {generatingAction === "download" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            הורד PDF
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={handlePrint}>
            <Printer className="size-3.5" />
            הדפס
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <DocumentViewerDialog doc={viewingDoc} onOpenChange={(o) => !o && setViewingDoc(null)} />
    </>
  );
}
