"use client";

// לשונית "הצעות מחיר" בכרטיס האירוע: מחשבון למעלה (הצעה חדשה / עריכה / שכפול),
// ורשימת ההצעות שנשלחו למטה. כל תאריך בשורה משלו עם ערוך / שכפל / סגור.
// עריכת תאריך מהצעה עם כמה תאריכים מוציאה אותו להצעה משלו, כי הזוג התמקד בו.
// רק "סגור תאריך זה" נוגע בעגלה: התאריך נכנס כשורות עגלה ותאריך האירוע נקבע.
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { CalendarCheck, Check, Copy, FileText, Paperclip, Pencil, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingCalculator, type CalcActionsCtx } from "@/components/leads/pricing-calculator";
import { useLeadsStore } from "@/store/use-leads-store";
import { useOrgDoc } from "@/lib/firebase/use-org-doc";
import { isFirebaseConfigured, storage } from "@/lib/firebase/client";
import { primaryContactName, primaryPhone, waLink } from "@/lib/format";
import type { LeadEvent, LeadQuote, LeadQuoteStatus } from "@/lib/types";
import type { Pricing, PricingOption } from "@/lib/pricing/types";
import { DAY_NAMES, MONTHS, blockedByApproval, compute, discountOf, isOn, normalizePricing, yehudaDefaults } from "@/lib/pricing/engine";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { useOrgMembers } from "@/lib/firebase/use-org-members";
import { elementToPdfBlob } from "@/lib/generate-pdf";
import { isCalcLine, linesFromOption } from "@/lib/pricing/cart";

const nis = (n: number) => "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 2 });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
const dateLabel = (o: PricingOption) =>
  o.exact
    ? `${DAY_NAMES[new Date(o.exact + "T12:00").getDay()]} ${o.exact.split("-").reverse().join(".")}`
    : o.month != null && o.day != null ? `${MONTHS[o.month - 1]} · ${DAY_NAMES[o.day]}` : "—";

const STATUS: Record<LeadQuoteStatus, { label: string; cls: string }> = {
  sent: { label: "נשלחה", cls: "bg-muted text-muted-foreground" },
  think: { label: "חושבים", cls: "bg-amber-100 text-amber-900" },
  won: { label: "נסגרה", cls: "bg-emerald-100 text-emerald-900" },
  lost: { label: "ירדה", cls: "bg-red-100 text-red-900" },
};

type Draft = { mode: "new" } | { mode: "edit"; quote: LeadQuote; index: number } | { mode: "copy"; from: LeadQuote; index: number };

export function QuotesTab({ lead, onClosed }: { lead: LeadEvent; onClosed?: () => void }) {
  const { orgDoc } = useOrgDoc();
  const P = useMemo(() => (orgDoc?.pricing ? normalizePricing(orgDoc.pricing) : yehudaDefaults()), [orgDoc?.pricing]);
  const orgId = useLeadsStore((s) => s.orgId);
  const setLeadQuotes = useLeadsStore((s) => s.setLeadQuotes);
  const updateLeadCart = useLeadsStore((s) => s.updateLeadCart);
  const saveCalc = useLeadsStore((s) => s.setLeadPricingCalc);
  const updateLeadSchedule = useLeadsStore((s) => s.updateLeadSchedule);
  const updateLeadGuests = useLeadsStore((s) => s.updateLeadGuests);
  const addSystemActivity = useLeadsStore((s) => s.addSystemActivity);
  const currentUserId = useLeadsStore((s) => s.currentUserId);
  const addTask = useLeadsStore((s) => s.addTask);
  const reserveDate = useLeadsStore((s) => s.reserveDate);
  const calendarEvents = useLeadsStore((s) => s.calendarEvents);
  const isAdmin = useCurrentRole() === "admin";
  const { members } = useOrgMembers();
  const orgFiles = useLeadsStore((s) => s.orgFiles);

  const quotes = lead.quotes ?? [];
  const [draft, setDraft] = useState<Draft>({ mode: "new" });
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [pdfQuote, setPdfQuote] = useState<LeadQuote | null>(null);
  const [sending, setSending] = useState(false);

  const startEdit = (q: LeadQuote, index: number) => { setDraft({ mode: "edit", quote: q, index }); setFiles(q.files); };
  const startCopy = (q: LeadQuote, index: number) => { setDraft({ mode: "copy", from: q, index }); setFiles(q.files); };
  const cancel = () => { setDraft({ mode: "new" }); setFiles([]); setPickOpen(false); };

  const initial =
    draft.mode === "edit" ? { guests: draft.quote.guests, options: [draft.quote.options[draft.index]] }
    : draft.mode === "copy" ? { guests: draft.from.guests, options: [draft.from.options[draft.index]] }
    : undefined;
  const calcKey = draft.mode === "new" ? `new-${quotes.length}`
    : `${draft.mode}-${draft.mode === "edit" ? draft.quote.quote_id : draft.from.quote_id}-${draft.index}`;

  const upload = async (f: File) => {
    setUploading(true);
    try {
      let url: string;
      if (isFirebaseConfigured && storage && orgId) {
        const fileRef = storageRef(storage, `organizations/${orgId}/leads/${lead.lead_id}/quote-files/${Date.now()}-${f.name}`);
        await uploadBytes(fileRef, f, { contentType: f.type });
        url = await getDownloadURL(fileRef);
      } else url = URL.createObjectURL(f);
      setFiles((x) => [...x, { name: f.name.replace(/\.[^.]+$/, ""), url }]);
    } catch {
      toast.error("העלאת הקובץ נכשלה");
    } finally {
      setUploading(false);
    }
  };

  // מצייר את כרטיס ההצעה מחוץ למסך, הופך ל-PDF ומעלה. מחזיר קישור (או null בדמו)
  const buildPdf = async (q: LeadQuote): Promise<string | null> => {
    setPdfQuote(q);
    await new Promise((r) => setTimeout(r, 60)); // עד שהכרטיס מצויר
    if (!pdfRef.current) return null;
    const blob = await elementToPdfBlob(pdfRef.current);
    setPdfQuote(null);
    if (!(isFirebaseConfigured && storage && orgId)) return URL.createObjectURL(blob);
    const fileRef = storageRef(storage, `organizations/${orgId}/leads/${lead.lead_id}/documents/${Date.now()}-quote-${q.number}.pdf`);
    await uploadBytes(fileRef, blob, { contentType: "application/pdf" });
    return getDownloadURL(fileRef);
  };

  const messageFor = (q: LeadQuote, pdfUrl: string | null) => {
    const lines = q.options.map((o) => {
      const r = compute(P, o, q.guests);
      return `• ${dateLabel(o)}: ${nis(r.per)} למנה הכל כלול (${nis(r.total)} לאירוע)`;
    });
    const fileLines = q.files.map((f) => `${f.name}: ${f.url}`);
    return [
      `היי ${primaryContactName(lead)}, מצורפת הצעת המחיר מ${orgDoc?.name ?? "האולם"} ל-${q.guests} אורחים:`,
      ...lines,
      ...(pdfUrl ? ["", `להצעה המלאה: ${pdfUrl}`] : []),
      ...(fileLines.length ? ["", ...fileLines] : []),
    ].join("\n");
  };

  const submit = async (ctx: CalcActionsCtx, send: boolean) => {
    if (!ctx.valid) return toast.error("חסר מספר אורחים, חודש או יום באחד התאריכים");
    const now = new Date().toISOString();
    // הנחה מעבר לסף: נשאר אישור קודם אם המחיר לא השתנה, אחרת ממתין לאישור
    ctx = { ...ctx, opts: ctx.opts.map((o) => {
      const { approval, ...rest } = o;
      if (!discountOf(P, rest, ctx.guests).needs) return rest;
      const base = compute(P, rest, ctx.guests).base;
      return { ...rest, approval: approval && approval.base === base ? approval : { status: "pending" as const, base } };
    }) };
    if (send && ctx.opts.some((o) => blockedByApproval(P, o, ctx.guests))) {
      send = false;
      toast.warning("יש תאריך עם הנחה שממתינה לאישור מנהל. ההצעה נשמרה ולא נשלחה");
    }
    const nextNumber = Math.max(0, ...quotes.map((q) => q.number)) + 1;
    let list: LeadQuote[];
    let saved: LeadQuote;
    if (draft.mode === "edit" && draft.quote.options.length === 1) {
      saved = { ...draft.quote, guests: ctx.guests, options: ctx.opts, files, updated_at: now };
      list = quotes.map((q) => (q.quote_id === saved.quote_id ? saved : q));
    } else {
      const base: LeadQuote = { quote_id: crypto.randomUUID(), number: nextNumber, sent_at: now, guests: ctx.guests, status: "sent", options: ctx.opts, files };
      if (draft.mode === "edit") {
        // תאריך אחד מתוך כמה: יוצא להצעה משלו, והשאר נשארים במקורית
        const src = draft.quote, idx = draft.index;
        saved = { ...base, from: src.number };
        list = [saved, ...quotes.map((q) => (q.quote_id === src.quote_id ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q))];
      } else {
        saved = draft.mode === "copy" ? { ...base, from: draft.from.number } : base;
        list = [saved, ...quotes];
      }
    }
    setLeadQuotes(lead.lead_id, list);
    if (send) {
      const phone = primaryPhone(lead);
      // חלון נפתח מיד (לפני await) כדי שהדפדפן לא יחסום אותו
      const win = phone ? window.open("", "_blank") : null;
      setSending(true);
      try {
        const pdfUrl = await buildPdf(saved);
        if (pdfUrl && isFirebaseConfigured) {
          setLeadQuotes(lead.lead_id, list.map((q) => (q.quote_id === saved.quote_id ? { ...q, pdf_url: pdfUrl } : q)));
        }
        if (win) win.location.href = waLink(phone, messageFor(saved, isFirebaseConfigured ? pdfUrl : null));
        else toast.error("אין טלפון לזוג. ההצעה נשמרה בלי שליחה");
        addSystemActivity(lead.lead_id, "whatsapp", `נשלחה הצעת מחיר #${saved.number} ב-WhatsApp ל${primaryContactName(lead)}.`);
      } catch {
        win?.close();
        toast.error("הפקת ה-PDF נכשלה. ההצעה נשמרה");
      } finally {
        setSending(false);
      }
    }
    toast.success(send ? "ההצעה נשמרה ונשלחה" : "ההצעה נשמרה");
    cancel();
  };

  const setStatus = (q: LeadQuote, status: LeadQuoteStatus) =>
    setLeadQuotes(lead.lead_id, quotes.map((x) => (x.quote_id === q.quote_id ? { ...x, status } : x)));

  const decide = (q: LeadQuote, index: number, status: "approved" | "rejected") => {
    const o = q.options[index];
    const approval = { status, base: compute(P, o, q.guests).base, by: currentUserId, at: new Date().toISOString() };
    setLeadQuotes(lead.lead_id, quotes.map((x) => (x.quote_id === q.quote_id ? { ...x, options: x.options.map((y, j) => (j === index ? { ...y, approval } : y)) } : x)));
    addSystemActivity(lead.lead_id, "note", `ההנחה ב${dateLabel(o)} (הצעה #${q.number}) ${status === "approved" ? "אושרה" : "נדחתה"}.`);
  };

  // בקשת אישור: מטלה לכל מנהל, מקושרת לכרטיס
  const askApproval = (q: LeadQuote, index: number) => {
    const o = q.options[index];
    const { pct } = discountOf(P, o, q.guests);
    const admins = members.filter((m) => m.role === "admin" && m.is_active);
    for (const m of admins) addTask({
      lead_id: lead.lead_id, assigned_user_id: m.user_id, created_by_user_id: currentUserId,
      title: `אישור הנחה ${pct}%: ${primaryContactName(lead)}, ${dateLabel(o)} (הצעה #${q.number})`,
      due_date: new Date().toISOString(),
    });
    toast.success(admins.length ? "נשלחה מטלה למנהל לאישור" : "אין מנהל פעיל במערכת");
  };

  // שריון התאריך ביומן האולם (option_hold) — אותה פעולה כמו ביומן, כולל מטלת מעקב
  const holdOf = (iso: string) =>
    calendarEvents.find((e) => e.lead_id === lead.lead_id && e.event_type === "option_hold" && e.start_time.slice(0, 10) === new Date(iso + "T12:00").toISOString().slice(0, 10));
  const hold = (o: PricingOption) => {
    if (!o.exact) return toast.error("לתאריך הזה אין תאריך מדויק. ערוך ובחר תאריך לפני שריון");
    const days = Number(prompt("לכמה ימים לשריין?", "7"));
    if (!days || days < 1) return;
    const start = new Date(o.exact + "T12:00"), end = new Date(o.exact + "T23:59");
    const expiry = new Date(); expiry.setDate(expiry.getDate() + days); expiry.setHours(23, 59, 0, 0);
    let res = reserveDate(lead.lead_id, start.toISOString(), end.toISOString(), expiry.toISOString());
    if (!res.success && res.conflict) {
      if (!confirm("התאריך כבר תפוס או משוריין לזוג אחר ביומן. לשריין בכל זאת?")) return;
      res = reserveDate(lead.lead_id, start.toISOString(), end.toISOString(), expiry.toISOString(), true);
    }
    if (res.success) toast.success(`${dateLabel(o)} שוריין ל-${days} ימים`);
  };

  const closeDate = (q: LeadQuote, index: number) => {
    const o = q.options[index];
    if (!o.exact) return toast.error("לתאריך הזה אין תאריך מדויק. ערוך ובחר תאריך לפני סגירה");
    if (blockedByApproval(P, o, q.guests)) return toast.error("ההנחה בתאריך הזה עדיין לא אושרה על ידי מנהל");
    if (!confirm(`לסגור את ${dateLabel(o)}? המחירים ייכנסו לעגלה ותאריך האירוע ייקבע.`)) return;
    const keep = (lead.cart ?? []).filter((l) => !isCalcLine(l));
    updateLeadCart(lead.lead_id, [...linesFromOption(P, o, q.guests), ...keep]);
    saveCalc(lead.lead_id, { guests: q.guests, options: [o] });
    updateLeadSchedule(lead.lead_id, { event_date: o.exact, event_start_time: lead.event_start_time, event_end_time: lead.event_end_time });
    updateLeadGuests(lead.lead_id, q.guests);
    setLeadQuotes(lead.lead_id, quotes.map((x) => (x.quote_id === q.quote_id ? { ...x, status: "won", closed_index: index, closed_at: new Date().toISOString(), closed_by: currentUserId, commission_rate: P.commission, commission_paid: false } : x)));
    addSystemActivity(lead.lead_id, "note", `נסגר תאריך ${dateLabel(o)} מהצעה #${q.number}.`);
    toast.success("נכנס לעגלה. ממשיכים לחוזה בלשונית תשלומים");
    onClosed?.();
  };

  const editingTitle =
    draft.mode === "edit" ? `עריכת הצעה #${draft.quote.number} · ${dateLabel(draft.quote.options[draft.index])}`
    : draft.mode === "copy" ? `שכפול מהצעה #${draft.from.number}` : "הצעה חדשה";

  return (
    <div className="grid gap-3.5">
      <section className={`overflow-hidden rounded-xl bg-card ${draft.mode === "new" ? "border border-border" : "border-2 border-primary"}`}>
        <div className="flex items-center gap-2 px-3 pt-3 font-semibold">
          {draft.mode !== "new" && <Pencil className="size-4" />}
          {editingTitle}
          {draft.mode !== "new" && (
            <button className="ms-auto text-xs font-normal text-muted-foreground" onClick={cancel}><X className="inline size-3" /> ביטול</button>
          )}
        </div>
        <PricingCalculator
          key={calcKey}
          lead={lead}
          initial={initial}
          renderActions={(ctx) => (
            <div className="grid w-full gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {files.map((f, i) => (
                  <span key={f.url} className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-primary">
                    <FileText className="size-3.5" />{f.name}
                    <button aria-label="הסר קובץ" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X className="size-3" /></button>
                  </span>
                ))}
                <button className="flex items-center gap-1 rounded-md border border-border px-2 py-1" onClick={() => setPickOpen((v) => !v)}>
                  <FileText className="size-3.5" />מהמאגר
                </button>
                <button className="flex items-center gap-1 rounded-md border border-border px-2 py-1" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  <Paperclip className="size-3.5" />{uploading ? "מעלה..." : "צרף קובץ"}
                </button>
                <input ref={fileInput} type="file" accept="application/pdf,image/*" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              </div>
              {pickOpen && (
                <div className="flex flex-wrap gap-1.5 rounded-md bg-muted/40 p-2 text-xs">
                  {orgFiles.length === 0 && <span className="text-muted-foreground">אין קבצים במאגר (הגדרות ← קבצים)</span>}
                  {orgFiles.map((f) => {
                    const on = files.some((x) => x.url === f.url);
                    return (
                      <button key={f.file_id} className={`rounded-md border px-2 py-1 ${on ? "border-primary text-primary" : "border-border"}`}
                        onClick={() => setFiles((x) => (on ? x.filter((y) => y.url !== f.url) : [...x, { name: f.name, url: f.url }]))}>
                        {on && <Check className="inline size-3" />} {f.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="gap-1.5" disabled={sending} onClick={() => submit(ctx, true)}>
                  <Send className="size-3.5" />{draft.mode === "edit" ? "שמור ושלח שוב" : "שלח הצעת מחיר"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => submit(ctx, false)}>שמור בלי לשלוח</Button>
              </div>
            </div>
          )}
        />
      </section>

      {pdfQuote && (
        <div style={{ position: "fixed", left: -10000, top: 0 }}>
          <QuoteCard ref={pdfRef} q={pdfQuote} P={P} orgName={orgDoc?.name ?? ""} logoUrl={orgDoc?.logoUrl} couple={primaryContactName(lead)} />
        </div>
      )}

      <div className="font-semibold">הצעות שנשלחו</div>
      {quotes.length === 0 && <div className="text-sm text-muted-foreground">עדיין לא נשלחו הצעות לזוג הזה.</div>}
      {quotes.filter((q) => q.options.length > 0).map((q) => (
        <section key={q.quote_id} className="overflow-hidden rounded-xl border border-border bg-card text-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
            <b>הצעה #{q.number}</b>
            <span className="flex-1 text-xs text-muted-foreground">
              {q.from && `מתוך #${q.from} · `}נשלחה {shortDate(q.sent_at)}{q.updated_at && ` · עודכנה ${shortDate(q.updated_at)}`} · {q.guests} אורחים
              {q.files.length > 0 && ` · ${q.files.length} קבצים`}
            </span>
            {q.pdf_url && <a href={q.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">PDF</a>}
            <select className={`h-7 rounded-md border-0 px-2 text-xs ${STATUS[q.status].cls}`} value={q.status}
              onChange={(e) => setStatus(q, e.target.value as LeadQuoteStatus)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          {q.options.map((o, i) => {
            const r = compute(P, o, q.guests);
            const closed = q.status === "won" && q.closed_index === i;
            const disc = discountOf(P, o, q.guests);
            const blocked = blockedByApproval(P, o, q.guests);
            const rejected = blocked && o.approval?.status === "rejected" && o.approval.base === r.base;
            return (
              <div key={i} className={`flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 ${closed ? "bg-emerald-50" : ""}`}>
                <span className="flex-1">{dateLabel(o)} · {nis(r.per)} למנה · {nis(r.total)}</span>
                {disc.needs && !closed && (
                  <span className={`rounded px-1.5 py-0.5 text-xs ${!blocked ? "bg-emerald-100 text-emerald-900" : rejected ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"}`}>
                    הנחה {disc.pct}% · {!blocked ? "אושרה" : rejected ? "נדחתה" : "ממתינה לאישור מנהל"}
                  </span>
                )}
                {blocked && !closed && (isAdmin ? (
                  <>
                    <Button size="sm" onClick={() => decide(q, i, "approved")}>אשר הנחה</Button>
                    {!rejected && <Button size="sm" variant="outline" onClick={() => decide(q, i, "rejected")}>דחה</Button>}
                  </>
                ) : !rejected && <Button size="sm" variant="outline" onClick={() => askApproval(q, i)}>בקש אישור</Button>)}
                {closed ? <span className="text-xs font-medium text-emerald-700"><Check className="inline size-3.5" /> נסגר</span> : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => startEdit(q, i)}><Pencil className="size-3.5" />ערוך</Button>
                    <Button size="sm" variant="outline" onClick={() => startCopy(q, i)}><Copy className="size-3.5" />שכפל</Button>
                    {o.exact && (holdOf(o.exact)
                      ? <span className="text-xs text-amber-700">משוריין</span>
                      : <Button size="sm" variant="outline" onClick={() => hold(o)}><CalendarCheck className="size-3.5" />שריין</Button>)}
                    <Button size="sm" variant="outline" onClick={() => closeDate(q, i)}><Check className="size-3.5" />סגור תאריך זה</Button>
                  </>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

// כרטיס ההצעה כפי שהזוג מקבל אותו ב-PDF. תמיד בהיר, בגודל טלפון.
function QuoteCard({ ref, q, P, orgName, logoUrl, couple }: {
  ref: React.Ref<HTMLDivElement>; q: LeadQuote; P: Pricing; orgName: string; logoUrl?: string; couple: string;
}) {
  const rows = q.options.map((o) => ({ o, r: compute(P, o, q.guests) }));
  const best = rows.length > 1 ? Math.min(...rows.map((x) => x.r.per)) : null;
  return (
    <div ref={ref} dir="rtl" style={{ width: 420, background: "#fff", color: "#1a1a1a", padding: 28, fontFamily: "Assistant, Arial, sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        {logoUrl && <img src={logoUrl} alt="" crossOrigin="anonymous" style={{ height: 56, objectFit: "contain", margin: "0 auto 8px" }} />}
        <div style={{ fontSize: 22, fontWeight: 700 }}>{orgName}</div>
        <div style={{ fontSize: 14, color: "#666" }}>הצעת מחיר #{q.number} · {couple} · {q.guests} אורחים</div>
      </div>
      {rows.map(({ o, r }, i) => (
        <div key={i} style={{ border: `1.5px solid ${r.per === best ? "#0f7a5c" : "#e5e5e5"}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          {r.per === best && <div style={{ fontSize: 12, color: "#0f7a5c", fontWeight: 700, marginBottom: 4 }}>המשתלם ביותר</div>}
          <div style={{ fontSize: 16, fontWeight: 700 }}>{dateLabel(o)}</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "4px 0" }}>{nis(r.per)} <span style={{ fontSize: 14, fontWeight: 400 }}>למנה, הכל כלול</span></div>
          <div style={{ fontSize: 14, color: "#555" }}>סה״כ לאירוע: {nis(r.total)}</div>
          <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>
            כולל: {P.addons.filter((a) => isOn(a, o.st) && r.cost[a.id]).map((a) => a.name).join(" · ") || "מחיר מנה בלבד"}
          </div>
        </div>
      ))}
      {q.files.length > 0 && (
        <div style={{ fontSize: 13, color: "#555", marginTop: 8 }}>מצורף: {q.files.map((f) => f.name).join(" · ")}</div>
      )}
    </div>
  );
}
