import { useEffect, useState } from "react";

export interface HebrewCalendarDay {
  /** תווית לתצוגה על גבי היום (חג / מועד / ראש חודש). */
  label?: string;
  /** התאריך העברי המלא של היום (יום+חודש), לתצוגה קטנה תחת המספר הלועזי. */
  hebrewDate?: string;
}

interface YearData {
  labels: Map<string, string>; // date -> חג/ראש חודש
  hebrewDates: Map<string, string>; // date -> "י״ז תמוז"
}

interface HebcalItem {
  title: string;
  hebrew?: string;
  date: string;
  category: string;
}

const cache = new Map<number, YearData>();
const inFlight = new Map<number, Promise<YearData>>();

async function fetchYear(year: number): Promise<YearData> {
  if (cache.has(year)) return cache.get(year)!;
  if (inFlight.has(year)) return inFlight.get(year)!;

  const promise = fetch(
    `https://www.hebcal.com/hebcal?cfg=json&year=${year}&v=1&maj=on&min=on&mod=on&nx=on&d=on&ss=on&mf=on&lg=he`
  )
    .then((res) => (res.ok ? res.json() : { items: [] }))
    .then((data: { items?: HebcalItem[] }) => {
      const labels = new Map<string, string>();
      const hebrewDates = new Map<string, string>();
      for (const item of data.items ?? []) {
        const date = item.date.slice(0, 10);
        if (item.category === "holiday" || item.category === "roshchodesh") {
          const existing = labels.get(date);
          labels.set(date, existing ? `${existing} · ${item.hebrew ?? item.title}` : (item.hebrew ?? item.title));
        } else if (item.category === "hebdate") {
          hebrewDates.set(date, item.hebrew ?? item.title);
        }
      }
      const result = { labels, hebrewDates };
      cache.set(year, result);
      return result;
    })
    .catch(() => {
      const empty = { labels: new Map<string, string>(), hebrewDates: new Map<string, string>() };
      cache.set(year, empty);
      return empty;
    })
    .finally(() => inFlight.delete(year));

  inFlight.set(year, promise);
  return promise;
}

/**
 * לוח השנה העברי (Hebcal) עבור כמה שנים אזרחיות — שימושי לגריד חודשי שעשוי
 * לחצות שנה. מחזיר שתי מפות: labels (חגים/מועדים/ראשי חודש, לתצוגה בולטת)
 * ו-hebrewDates (התאריך העברי של כל יום, לתצוגה קטנה תחת המספר הלועזי).
 */
export function useJewishHolidaysForYears(years: number[]): {
  labels: Map<string, string>;
  hebrewDates: Map<string, string>;
} {
  const [data, setData] = useState<YearData[]>([]);
  const key = years.join(",");

  useEffect(() => {
    let cancelled = false;
    Promise.all(years.map(fetchYear)).then((results) => {
      if (!cancelled) setData(results);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const labels = new Map<string, string>();
  const hebrewDates = new Map<string, string>();
  for (const d of data) {
    for (const [k, v] of d.labels) labels.set(k, v);
    for (const [k, v] of d.hebrewDates) hebrewDates.set(k, v);
  }
  return { labels, hebrewDates };
}
