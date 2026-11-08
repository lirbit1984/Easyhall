"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLeadsStore } from "@/store/use-leads-store";
import { useCurrentRole } from "@/lib/firebase/use-current-role";
import { primaryContactName } from "@/lib/format";
import type { IplanEvent } from "@/lib/types";

/**
 * ייבוא יומן מ-iPlan: המשרד מייצא כל בוקר "כרטיסי אירוע" לאקסל ומעלה כאן.
 * זיהוי לפי "קוד אירוע". חדשים נוספים, שינויים מתעדכנים, ואירוע שנעלם מהקובץ
 * מסומן כבוטל רק אם מסמנים אותו. אירועי iPlan תופסים את התאריך (checkDateCollision).
 * בנוסף: "ממתין ל-iPlan" — אירועים שנסגרו כאן ועדיין אין להם אירוע ב-iPlan באותו יום.
 */
const today = () => new Date().toLocaleDateString("en-CA");
const short = (ymd: string) => { const [y, m, d] = ymd.split("-"); return `${+d}.${+m}.${y.slice(2)}`; };

function xlDate(v: unknown): string | null {
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10);
  const m = String(v ?? "").match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
function xlTime(v: unknown): string {
  if (typeof v === "number") { const mn = Math.round((v % 1) * 1440); return `${String(Math.floor(mn / 60)).padStart(2, "0")}:${String(mn % 60).padStart(2, "0")}`; }
  return String(v ?? "").trim();
}

function parseIplan(rows: unknown[][]): IplanEvent[] | null {
  const hi = rows.findIndex((r) => r.some((c) => String(c).trim() === "קוד אירוע") && r.some((c) => String(c).trim() === "תאריך האירוע"));
  if (hi < 0) return null;
  const H = rows[hi].map((c) => String(c ?? "").trim());
  const get = (r: unknown[], n: string) => (H.indexOf(n) < 0 ? "" : r[H.indexOf(n)]);
  const t = today(), now = new Date().toISOString();
  const out: IplanEvent[] = [];
  for (const r of rows.slice(hi + 1)) {
    const code = parseInt(String(get(r, "קוד אירוע"))), date = xlDate(get(r, "תאריך האירוע"));
    if (!code || !date || date < t) continue;
    const g = parseInt(String(get(r, "מינימום אורחים")));
    out.push({
      code, event_date: date, name: String(get(r, "שם האירוע") ?? "").replace(/\s+/g, " ").trim(),
      type: String(get(r, "סוג אירוע") ?? "").trim(), status: String(get(r, "סטטוס") ?? "").trim(),
      start_time: xlTime(get(r, "שעת תחילת אירוע")), guests: g > 0 ? g : null,
      team: String(get(r, "צוות מטפל באירוע") ?? "").split(/\n/).map((x) => x.split(":").pop()!.trim()).filter(Boolean).join(", "),
      space: String(get(r, "תתי מתחמים") ?? "").trim(), imported_at: now,
    });
  }
  return out;
}

const FIELDS: Partial<Record<keyof IplanEvent, string>> = { event_date: "תאריך", name: "שם", type: "סוג", start_time: "שעה", guests: "אורחים", team: "צוות", status: "סטטוס", space: "מתחם" };
type Diff = { r: IplanEvent; o: IplanEvent; keys: (keyof IplanEvent)[] };

export function IplanImport() {
  const role = useCurrentRole();
  const iplanEvents = useLeadsStore((s) => s.iplanEvents);
  const leads = useLeadsStore((s) => s.leads);
  const importIplan = useLeadsStore((s) => s.importIplan);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imp, setImp] = useState<{ fname: string; list: IplanEvent[]; neu: IplanEvent[]; upd: Diff[]; gone: IplanEvent[]; same: number } | null>(null);
  const [cancel, setCancel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [showPending, setShowPending] = useState(false);

  // נסגר אצלנו, עתידי, ואין אירוע iPlan פעיל באותו תאריך
  const pending = useMemo(() => {
    const t = today();
    const taken = new Set(iplanEvents.filter((e) => !e.cancelled).map((e) => e.event_date));
    return leads
      .filter((l) => l.status === "closed" && l.event_date && l.event_date.slice(0, 10) >= t && !taken.has(l.event_date.slice(0, 10)))
      .sort((a, b) => a.event_date!.localeCompare(b.event_date!));
  }, [leads, iplanEvents]);

  if (role !== "admin" && role !== "office") return null;

  const onFile = async (f: File) => {
    let rows: unknown[][];
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    } catch {
      return toast.error("לא הצלחתי לקרוא את הקובץ");
    }
    const list = parseIplan(rows);
    if (!list) return toast.error('זה לא נראה כמו ייצוא "כרטיסי אירוע" מ-iPlan (חסרות העמודות "קוד אירוע" ו"תאריך האירוע")');
    const t = today();
    const db = new Map(iplanEvents.filter((e) => e.event_date >= t).map((e) => [e.code, e]));
    const inFile = new Set(list.map((x) => x.code));
    const neu: IplanEvent[] = [], upd: Diff[] = [];
    let same = 0;
    for (const r of list) {
      const o = db.get(r.code);
      if (!o || o.cancelled) { neu.push(r); continue; }
      const keys = (Object.keys(FIELDS) as (keyof IplanEvent)[]).filter((k) => String(o[k] ?? "") !== String(r[k] ?? ""));
      if (keys.length) upd.push({ r, o, keys }); else same++;
    }
    const gone = [...db.values()].filter((o) => !o.cancelled && !inFile.has(o.code));
    const byD = (a: IplanEvent, b: IplanEvent) => a.event_date.localeCompare(b.event_date);
    neu.sort(byD); upd.sort((a, b) => byD(a.r, b.r)); gone.sort(byD);
    setCancel(new Set(gone.map((g) => g.code)));
    setImp({ fname: f.name, list, neu, upd, gone, same });
  };

  const run = async () => {
    if (!imp) return;
    setBusy(true);
    try {
      await importIplan(imp.list, [...cancel]);
      toast.success("היומן עודכן מ-iPlan");
      setImp(null);
    } catch {
      toast.error("הייבוא נכשל");
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ tag, cls, e, extra }: { tag: string; cls: string; e: IplanEvent; extra: React.ReactNode }) => (
    <div className="flex items-center gap-2 border-b border-border py-1.5 text-sm last:border-b-0">
      <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{tag}</span>
      <span className="w-16 shrink-0 tabular-nums">{short(e.event_date)}</span>
      <span className="min-w-0 flex-1 truncate">{e.name}</span>
      <span className="text-xs text-muted-foreground">{extra}</span>
    </div>
  );

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
        <Upload className="size-3.5" />ייבוא מ-iPlan
      </Button>
      {pending.length > 0 && (
        <Button variant="outline" size="sm" className="border-amber-300 text-amber-800" onClick={() => setShowPending(true)}>
          {pending.length} ממתינים ל-iPlan
        </Button>
      )}

      <Dialog open={showPending} onOpenChange={setShowPending}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>ממתינים להזנה ב-iPlan</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">אירועים שנסגרו כאן ועדיין אין להם אירוע ב-iPlan באותו תאריך.</p>
          <div className="max-h-80 overflow-y-auto">
            {pending.map((l) => (
              <div key={l.lead_id} className="flex gap-2 border-b border-border py-1.5 text-sm last:border-b-0">
                <span className="w-16 tabular-nums">{short(l.event_date!.slice(0, 10))}</span>
                <span className="flex-1">{primaryContactName(l)}</span>
                <span className="text-muted-foreground">{l.estimated_guests || ""}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imp} onOpenChange={(o) => !o && setImp(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>ייבוא מ-iPlan</DialogTitle></DialogHeader>
          {imp && (
            <>
              <div className="text-sm text-muted-foreground">{imp.fname} · {imp.list.length} אירועים מהיום והלאה</div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {([[imp.neu.length, "חדשים", "bg-emerald-50 text-emerald-800"], [imp.upd.length, "שונו", "bg-blue-50 text-blue-800"],
                  [imp.gone.length, "נעלמו מהקובץ", "bg-red-50 text-red-800"], [imp.same, "ללא שינוי", "bg-muted text-muted-foreground"]] as const).map(([n, l, c]) => (
                  <div key={l} className={`rounded-md p-2 ${c}`}><b className="block text-lg">{n}</b>{l}</div>
                ))}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {imp.neu.map((r) => <Row key={"n" + r.code} tag="חדש" cls="bg-emerald-100 text-emerald-900" e={r} extra={[r.type, r.start_time, r.team.split(",")[0]].filter(Boolean).join(" · ")} />)}
                {imp.upd.map(({ r, o, keys }) => (
                  <Row key={"u" + r.code} tag="שונה" cls="bg-blue-100 text-blue-900" e={r}
                    extra={keys.map((k) => `${FIELDS[k]}: ${k === "event_date" ? short(o[k]) : o[k] ?? ""} ← ${k === "event_date" ? short(r[k]) : r[k] ?? ""}`).join(" · ")} />
                ))}
                {imp.gone.map((o) => (
                  <Row key={"g" + o.code} tag="בוטל?" cls="bg-red-100 text-red-900" e={o} extra={
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={cancel.has(o.code)} onChange={(e) => setCancel((s) => { const n = new Set(s); if (e.target.checked) n.add(o.code); else n.delete(o.code); return n; })} />
                      לסמן כבוטל
                    </label>
                  } />
                ))}
                {!imp.neu.length && !imp.upd.length && !imp.gone.length && <div className="py-3 text-sm text-muted-foreground">אין שינויים.</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImp(null)}>ביטול</Button>
                <Button onClick={run} disabled={busy}>אשר ייבוא</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
