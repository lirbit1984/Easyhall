// מודל המחירון (version 2) — זהה למבנה ששמור ב-settings.prices באפליקציית המכירות של יהודה,
// כך שאפשר להעביר מחירון קיים כמו שהוא. ימים: 0=ראשון ... 5=שישי, 6=מוצ״ש.

export type AddonUnit = "event" | "person" | "table";
export type RuleType = "delta" | "pct" | "fixed";

export interface PricingSeason {
  id: string;
  name: string;
  months: number[]; // 1..12
}

export interface PricingGroup {
  id: string;
  name: string;
  default: string; // addon id, או "" = בלי בחירה
}

export interface PricingAddon {
  id: string;
  name: string;
  price: number;
  unit: AddonUnit;
  group: string; // "" = תוספת עצמאית (כן/לא)
  on: boolean; // דלוקה כברירת מחדל
  monthPrices: Record<number, number>; // חריג לפי חודש (מבנה ישן, עדיין נתמך)
  seasonPrices: Record<string, number>; // חריג לפי תקופה, למשל תאורה בינואר
  includedTables: number; // עיצוב: כלול עד X שולחנות
  extraPerTable: number; // ...ועוד ₪ לכל שולחן נוסף
}

export interface HolidayRange {
  from: string; // ISO date
  to: string;
}

export interface PricingRule {
  id: string;
  name: string;
  scope: string; // "all" | "dates" | "s:<seasonId>" | "m:<month>"
  days: number[];
  gMin: number | null;
  gMax: number | null;
  until: string; // ISO date, "" = בלי תוקף
  type: RuleType;
  value: number;
  on: boolean;
  heb: string[]; // תקופות בלוח העברי, רק ב-scope "dates"
  ranges: HolidayRange[];
}

export interface PricingSpace {
  id: string;
  name: string;
  adj: number; // ± ₪ למנה
}

export interface Pricing {
  version: 2;
  minGuests: number;
  guestsPerTable: number;
  commission: number; // אחוז
  tierBreak: number; // 1..100, ברירת מחדל 50
  approvalPct: number; // הנחה מהמחירון (%) שמעליה צריך אישור מנהל. 0 = כבוי
  seasons: PricingSeason[];
  brackets: number[];
  days: number[];
  table: Record<string, Record<number, Record<number, number | null>>>;
  groups: PricingGroup[];
  addons: PricingAddon[];
  rules: PricingRule[];
  spaces: PricingSpace[];
}

// מצב התוספות של תאריך אחד בהצעה — לכל תאריך מצב משלו.
export interface AddonState {
  on: Record<string, boolean>;
  sel: Record<string, string>; // groupId -> addonId
  over: Record<string, number>; // מחיר שהנציג דרס
}

// תאריך אחד במחשבון
export interface PricingOption {
  month: number | null;
  day: number | null;
  space?: string;
  manual?: number | null; // מחיר מנה שסוכם
  target?: number | null; // תקציב הכל כלול למנה
  ai?: boolean; // מצב "הכל כלול": מחשבים אחורה מ-target
  exact?: string | null; // תאריך מדויק (ISO), כשנבחר
  /** אישור מנהל להנחה — תקף רק למחיר המנה (base) שאושר */
  approval?: { status: "pending" | "approved" | "rejected"; base: number; by?: string; at?: string };
  st: AddonState;
}

export interface OptionResult {
  guests: number;
  list: number | null; // מחיר מחירון אחרי כללים וחלל
  base: number; // מחיר מנה בפועל
  cost: Record<string, number>; // עלות כל תוספת לאירוע
  add: number;
  addPP: number;
  per: number; // הכל כלול למנה
  total: number;
  ok: boolean;
  season: PricingSeason | null;
  rules: PricingRule[];
  fromTarget: boolean;
  priced: boolean;
}
