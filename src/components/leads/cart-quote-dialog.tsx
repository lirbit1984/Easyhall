"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Download, Loader2, Plus, Printer, X } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { storage, isFirebaseConfigured } from "@/lib/firebase/client";
import { elementToPdfBlob } from "@/lib/generate-pdf";
import {
  formatCurrency,
  formatDate,
  getEventTitle,
  primaryContactName,
  primaryPhone,
  waLink,
} from "@/lib/format";
import type { LeadEvent, QuoteOptionalDate } from "@/lib/types";

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
}: {
  lead: LeadEvent;
  items: QuoteItem[];
  vatPercent: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const orgId = useLeadsStore((s) => s.orgId);
  const { orgDoc } = useOrgDoc();
  const eventTypes = useLeadsStore((s) => s.eventTypes);
  const promisePresets = useLeadsStore((s) => s.promisePresets);
  const addPromisePreset = useLeadsStore((s) => s.addPromisePreset);
  const setPromises = useLeadsStore((s) => s.setPromises);
  const setLeadQuoteOptionalDates = useLeadsStore((s) => s.setLeadQuoteOptionalDates);
  const addDocument = useLeadsStore((s) => s.addDocument);
  const addActivity = useLeadsStore((s) => s.addActivity);

  const previewRef = useRef<HTMLDivElement>(null);
  const [docType, setDocType] = useState<"quote" | "contract">("quote");
  const [dates, setDates] = useState<QuoteOptionalDate[]>(
    lead.quote_optional_dates?.length ? lead.quote_optional_dates : [newDateRow(lead.event_date ?? "")]
  );
  const [promisesDraft, setPromisesDraft] = useState(lead.promises ?? "");
  const [generating, setGenerating] = useState(false);

  const eventTypeName = eventTypes.find((t) => t.event_type_id === lead.event_type_id)?.name ?? "";
  const matchingPresets = promisePresets.filter((p) => p.event_type_name === eventTypeName);
  const multiDate = dates.length > 1;

  const addDateRow = () => setDates((prev) => [...prev, newDateRow()]);
  const removeDateRow = (id: string) => setDates((prev) => (prev.length > 1 ? prev.filter((d) => d.date_id !== id) : prev));
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
    addPromisePreset(eventTypeName, promisesDraft);
    toast.success(`נשמר כפריסט עבור "${eventTypeName}"`);
  };

  const docLabel = docType === "quote" ? "הצעת מחיר" : "חוזה התקשרות";

  const generateAndStore = async (): Promise<string | null> => {
    if (!previewRef.current) return null;
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
  };

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      const url = await generateAndStore();
      if (!url) {
        toast.error("לא ניתן היה להפיק את המסמך");
        return;
      }
      if (url !== "#") window.open(url, "_blank", "noopener,noreferrer");
      toast.success("המסמך הופק ונשמר בכרטיס האירוע");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהפקת המסמך");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    setGenerating(true);
    try {
      const url = await generateAndStore();
      addActivity(lead.lead_id, "whatsapp", `נשלחה ${docLabel} ב-WhatsApp ל${primaryContactName(lead)}.`);
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
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[90vh] grid-cols-1 gap-4 overflow-y-auto sm:max-w-5xl lg:grid-cols-2">
        <DialogHeader>
          <DialogTitle>הצעת מחיר / חוזה — {getEventTitle(lead)}</DialogTitle>
        </DialogHeader>

        {/* עמודת בקרה */}
        <div className="grid gap-3.5">
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
                <Input
                  type="date"
                  value={d.date}
                  onChange={(e) => updateDateValue(d.date_id, e.target.value)}
                  className="h-8"
                />
                {dates.length > 1 && (
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => removeDateRow(d.date_id)}>
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={saveDates}>
            שמור תאריכים לכרטיס האירוע
          </Button>

          <Separator />

          <div className="grid gap-1.5">
            <Label className="flex items-center justify-between">
              הבטחות והערות
              {matchingPresets.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">פריסטים ל&quot;{eventTypeName}&quot;:</span>
              )}
            </Label>
            {matchingPresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {matchingPresets.map((p) => (
                  <button
                    key={p.preset_id}
                    type="button"
                    onClick={() => applyPreset(p.text)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {p.text.length > 24 ? `${p.text.slice(0, 24)}…` : p.text}
                  </button>
                ))}
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

          <Separator />

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

          <div className="flex flex-wrap gap-2">
            <Button className="gap-1.5" onClick={handleSend} disabled={generating}>
              {generating ? <Loader2 className="size-3.5 animate-spin" /> : <WhatsappIcon className="size-3.5" />}
              שלח ב-WhatsApp
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={handleDownloadPdf} disabled={generating}>
              {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              הורד PDF
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              הדפס
            </Button>
          </div>
        </div>

        {/* תצוגה מקדימה */}
        <div className="aurora-card p-0 print:shadow-none" id="document-preview">
          <div ref={previewRef} className="bg-white p-6 text-black">
            <div className="mb-4 flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                {orgDoc?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={orgDoc.logoUrl} alt="" className="h-12 w-12 object-contain" />
                )}
                <div>
                  <h2 className="text-xl font-bold">{orgDoc?.name ?? "האולם"}</h2>
                  <p className="text-sm text-muted-foreground">{docLabel}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(new Date().toISOString())}</p>
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
              {!multiDate && dates[0]?.date && (
                <p>
                  <span className="text-muted-foreground">תאריך אירוע: </span>
                  {formatDate(dates[0].date)}
                </p>
              )}
            </div>

            <Separator className="my-3" />

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right">
                  <th className="py-1.5 font-medium">פריט</th>
                  <th className="py-1.5 font-medium">כמות</th>
                  {multiDate ? (
                    dates.map((d) => (
                      <th key={d.date_id} className="py-1.5 font-medium">
                        {d.date ? formatDate(d.date) : "תאריך"}
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
                      dates.map((d) => (
                        <td key={d.date_id} className="py-1.5">
                          {formatCurrency(priceFor(d.date_id, item))}
                        </td>
                      ))
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
                    <td className="py-2" colSpan={2}>
                      {formatCurrency(totalsForDate().total)}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>

            {multiDate && (
              <div className="mt-2 grid gap-1">
                <p className="text-xs font-medium text-muted-foreground">עריכת מחיר לפי תאריך:</p>
                {items.map((item) => (
                  <div key={item.item_id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-28 shrink-0">{item.name}</span>
                    {dates.map((d) => (
                      <Input
                        key={d.date_id}
                        type="number"
                        value={priceFor(d.date_id, item)}
                        onChange={(e) => updatePriceOverride(d.date_id, item.item_id, e.target.value)}
                        className="h-7 w-24 text-xs"
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {promisesDraft && (
              <>
                <Separator className="my-3" />
                <p className="whitespace-pre-line text-sm">{promisesDraft}</p>
              </>
            )}

            {docType === "contract" && (
              <>
                <Separator className="my-3" />
                <div className="whitespace-pre-line text-xs text-muted-foreground">
                  {orgDoc?.contractLegalText ?? "לא הוגדר נוסח חוזה — ניתן להגדיר בהגדרות > מיתוג וחוזה."}
                </div>
                <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
                  <div className="border-t border-black pt-1 text-center">חתימת מזמין א׳</div>
                  <div className="border-t border-black pt-1 text-center">חתימת מזמין ב׳</div>
                  <div className="border-t border-black pt-1 text-center">חתימת נציג {orgDoc?.name ?? "האולם"}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
