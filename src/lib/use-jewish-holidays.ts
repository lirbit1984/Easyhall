import { useEffect, useState } from "react";

export interface JewishHoliday {
  date: string; // ISO date (YYYY-MM-DD)
  title: string; // Hebrew title
}

const cache = new Map<number, JewishHoliday[]>();
const inFlight = new Map<number, Promise<JewishHoliday[]>>();

interface HebcalItem {
  title: string;
  titleOrig?: string;
  hebrew?: string;
  date: string;
  category: string;
}

async function fetchYear(year: number): Promise<JewishHoliday[]> {
  if (cache.has(year)) return cache.get(year)!;
  if (inFlight.has(year)) return inFlight.get(year)!;

  const promise = fetch(
    `https://www.hebcal.com/hebcal?cfg=json&year=${year}&v=1&maj=on&min=on&mod=on&ss=on&mf=on&lg=he`
  )
    .then((res) => (res.ok ? res.json() : { items: [] }))
    .then((data: { items?: HebcalItem[] }) => {
      const holidays = (data.items ?? [])
        .filter((i) => i.category === "holiday")
        .map((i) => ({ date: i.date.slice(0, 10), title: i.hebrew ?? i.title }));
      cache.set(year, holidays);
      return holidays;
    })
    .catch(() => {
      const empty: JewishHoliday[] = [];
      cache.set(year, empty);
      return empty;
    })
    .finally(() => inFlight.delete(year));

  inFlight.set(year, promise);
  return promise;
}

/** מחזיר מפה date(YYYY-MM-DD) -> שם החג/מועד, עבור שנה עברית-אזרחית נתונה. */
export function useJewishHolidays(year: number): Map<string, string> {
  const [holidays, setHolidays] = useState<JewishHoliday[]>(() => cache.get(year) ?? []);

  useEffect(() => {
    let cancelled = false;
    fetchYear(year).then((data) => {
      if (!cancelled) setHolidays(data);
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const map = new Map<string, string>();
  for (const h of holidays) map.set(h.date, h.title);
  return map;
}

/** כמו useJewishHolidays, אבל מאחד כמה שנים — שימושי לגריד חודשי שחוצה שנה. */
export function useJewishHolidaysForYears(years: number[]): Map<string, string> {
  const [holidays, setHolidays] = useState<JewishHoliday[]>([]);
  const key = years.join(",");

  useEffect(() => {
    let cancelled = false;
    Promise.all(years.map(fetchYear)).then((results) => {
      if (!cancelled) setHolidays(results.flat());
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const map = new Map<string, string>();
  for (const h of holidays) map.set(h.date, h.title);
  return map;
}
