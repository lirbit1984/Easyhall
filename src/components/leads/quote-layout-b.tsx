"use client";

// הצעת מחיר בפריסה ב': כרטיס לכל תאריך (1–4 בעמוד A4 אחד), הזול מסומן
// "המשתלם ביותר", ומתחת משבצות: כלול בכל אירוע, מילה אישית, איך סוגרים ו-QR לוואטסאפ.
// בלוק זה נלכד גם ל-PDF — לכן grid/margin רגילים ולא flex gap.
import { cn } from "@/lib/utils";

export interface QuoteCard {
  key: string;
  label: string;
  plate: number | null; // מחיר מנה (שורת המחשבון), אם יש
  rows: { name: string; amount: number }[];
  total: number;
}

// סכומים עם אגורות (415.25); formatCurrency של האפליקציה מעגל לשקל
const money = (n: number) => "₪" + n.toLocaleString("he-IL", { maximumFractionDigits: 2 });

const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

export function QuoteLayoutB({
  cards, guests, included, personal, closing, waUrl, repName,
}: {
  cards: QuoteCard[];
  guests: number;
  included: string;
  personal: string;
  closing: string;
  waUrl: string;
  repName: string;
}) {
  // "המשתלם ביותר" רק כשיש תאריך זול באמת מהשאר
  const min = Math.min(...cards.map((c) => c.total));
  const best = cards.length > 1 && cards.filter((c) => c.total === min).length === 1 ? min : null;
  const compact = cards.length >= 3;
  const box = "rounded-lg border border-[#e3e8ef] p-3 break-inside-avoid";

  return (
    <div className="text-sm">
      <div className={cn("grid gap-3", cards.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {cards.map((c) => {
          const isBest = best != null && c.total === best;
          return (
            <div key={c.key} className={cn(box, compact && "p-2 text-xs", isBest && "border-2 border-[#5980a6]")}>
              <div className="mb-1 font-bold">{c.label}</div>
              {isBest && <div className="mb-1 inline-block rounded-full bg-[#5980a6] px-2 py-0.5 text-[11px] text-white">המשתלם ביותר</div>}
              <table className="w-full">
                <tbody>
                  {c.plate != null && (
                    <tr className="border-b border-[#eef1f5]"><td className="py-0.5">מחיר מנה</td><td className="py-0.5 text-left">{money(c.plate)}</td></tr>
                  )}
                  {c.rows.map((r) => (
                    <tr key={r.name} className="border-b border-[#eef1f5]"><td className="py-0.5">{r.name}</td><td className="py-0.5 text-left">{money(r.amount)}</td></tr>
                  ))}
                  <tr className="font-bold"><td className="pt-1">סה״כ לאירוע</td><td className="pt-1 text-left">{money(c.total)}</td></tr>
                </tbody>
              </table>
              {guests > 0 && <div className="mt-1 text-[#5b6675]">{money(Math.round((c.total / guests) * 100) / 100)} למנה הכל כלול</div>}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {lines(included).length > 0 && (
          <div className={box}>
            <div className="mb-1 font-bold">כלול בכל אירוע אצלנו</div>
            <ul className="list-disc pr-4">{lines(included).map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        )}
        {personal.trim() && (
          <div className={box}>
            <div className="mb-1 font-bold">מילה אישית</div>
            <p className="whitespace-pre-line">{personal}</p>
          </div>
        )}
        {lines(closing).length > 0 && (
          <div className={box}>
            <div className="mb-1 font-bold">איך סוגרים</div>
            <ul className="list-disc pr-4">{lines(closing).map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        )}
        {/* TODO: QR לוואטסאפ — דורש ספריית qrcode; בינתיים קישור */}
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className={cn(box, "block")}>
          <b>אנחנו רוצים לסגור</b>
          <div className="text-[#5b6675]">לחצו כדי לשלוח ל{repName} בוואטסאפ</div>
        </a>
      </div>
    </div>
  );
}
