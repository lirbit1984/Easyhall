import { useEffect, useState } from "react";
import { toYMD } from "./calendar-grid";

/**
 * "היתר נישואין לספרדים" — שני חלונות בשנה העברית שבהם המנהג הספרדי (רב
 * עובדיה יוסף/שולחן ערוך) מתיר נישואין, בעוד המנהג האשכנזי הרווח (רמ"א)
 * עדיין נוהג בהם אבלות: מיד אחרי ל"ג בעומר (19 אייר) ועד ערב שבועות, ומ-17
 * בתמוז ועד ערב ראש חודש אב (לא כולל את תשעת הימים עצמם, שאסורים לכולם).
 * זהו מנהג מקובל אחד מבין כמה — הבעלים אישר את הטווח הזה במפורש.
 */

interface HebcalConvertResponse {
  gy: number;
  gm: number;
  gd: number;
}

const anchorCache = new Map<number, Promise<{ start: Date; end: Date }[]>>();

async function convertHebrewDate(hy: number, hm: string, hd: number): Promise<Date> {
  const res = await fetch(
    `https://www.hebcal.com/converter?cfg=json&hy=${hy}&hm=${hm}&hd=${hd}&h2g=1`
  );
  const data: HebcalConvertResponse = await res.json();
  return new Date(data.gy, data.gm - 1, data.gd);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** שני חלונות ה"היתר" עבור שנה עברית נתונה (הצירים תמיד באייר-אב, שאף פעם לא מושפעים מאדר א׳/אדר ב׳). */
async function fetchHeterWindows(hebrewYear: number): Promise<{ start: Date; end: Date }[]> {
  const [lagBaOmer, shavuot, tamuz17, roshChodeshAv] = await Promise.all([
    convertHebrewDate(hebrewYear, "Iyyar", 18),
    convertHebrewDate(hebrewYear, "Sivan", 6),
    convertHebrewDate(hebrewYear, "Tamuz", 17),
    convertHebrewDate(hebrewYear, "Av", 1),
  ]);
  return [
    { start: addDays(lagBaOmer, 1), end: addDays(shavuot, -1) },
    { start: tamuz17, end: addDays(roshChodeshAv, -1) },
  ];
}

function fetchHeterWindowsCached(hebrewYear: number): Promise<{ start: Date; end: Date }[]> {
  let promise = anchorCache.get(hebrewYear);
  if (!promise) {
    promise = fetchHeterWindows(hebrewYear).catch(() => []);
    anchorCache.set(hebrewYear, promise);
  }
  return promise;
}

/**
 * מפת "תאריך (YMD) → true" לכל הימים בשני חלונות ההיתר, עבור כל השנים
 * הלועזיות המבוקשות. שנה עברית אחת יכולה לחפוף לשתי שנים לועזיות סמוכות,
 * אז ממירים כל שנה לועזית לשנה העברית המקבילה (אביב/קיץ של שנה לועזית Y
 * חל תמיד בשנה העברית Y+3760).
 */
export function useHeterKiddushinDates(years: number[]): Set<string> {
  const [dates, setDates] = useState<Set<string>>(new Set());
  const key = years.join(",");

  useEffect(() => {
    let cancelled = false;
    const hebrewYears = Array.from(new Set(years.map((y) => y + 3760)));
    Promise.all(hebrewYears.map(fetchHeterWindowsCached)).then((results) => {
      if (cancelled) return;
      const next = new Set<string>();
      for (const windows of results) {
        for (const { start, end } of windows) {
          for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
            next.add(toYMD(d));
          }
        }
      }
      setDates(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return dates;
}
