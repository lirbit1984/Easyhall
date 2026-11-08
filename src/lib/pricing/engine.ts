import type {
  AddonState,
  OptionResult,
  Pricing,
  PricingAddon,
  PricingOption,
  PricingRule,
  PricingSeason,
} from "./types";

// מנוע התמחור של יהודה, טהור (בלי React/Firebase) — הועבר אחד-לאחד מ-yehuda-sales.html
// כדי שהמספרים יישארו זהים: יוני/ראשון/400 = 415.25, ינואר/ראשון/400 = 341.50,
// יוני/ראשון/400 עם בר פרימיום = 445.25.

export const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
export const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "מוצ״ש"];

const r2 = (n: number) => Math.round(n * 100) / 100;
let uidN = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(uidN++).toString(36)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------- ברירות המחדל של יהודה (המחירון המודפס) ----------
const N = null;
const YEHUDA_TABLE: Record<string, (number | null)[][]> = {
  summer: [[380, N, N, N, N, 370], [370, 380, 390, N, N, 360], [360, 370, 380, 400, 430, 350], [350, 360, 370, 380, 420, 340], [340, 350, 360, 370, 410, 330]],
  winter: [[320, 330, 340, 350, 380, 260], [310, 320, 330, 340, 370, 260], [300, 310, 320, 330, 360, 260], [290, 300, 310, 320, 350, 260], [280, 290, 300, 310, 340, 260]],
  transition: [[350, N, N, N, N, 350], [340, 360, 370, N, N, 340], [330, 340, 360, 380, 410, 330], [320, 330, 350, 360, 390, 320], [310, 320, 340, 340, 370, 310]],
};

function addon(a: Partial<PricingAddon> & Pick<PricingAddon, "id" | "name">): PricingAddon {
  return { price: 0, unit: "event", group: "", on: false, monthPrices: {}, seasonPrices: {}, includedTables: 0, extraPerTable: 0, ...a };
}

export function yehudaDefaults(): Pricing {
  const brackets = [300, 350, 400, 450, 500];
  const days = [0, 1, 2, 3, 4, 5];
  const seasons: PricingSeason[] = [
    { id: "summer", name: "קיץ", months: [5, 6, 7, 8, 9, 10] },
    { id: "winter", name: "חורף", months: [12, 1, 2] },
    { id: "transition", name: "מעבר", months: [3, 4, 11] },
  ];
  const table: Pricing["table"] = {};
  seasons.forEach((s) => {
    table[s.id] = {};
    brackets.forEach((b, i) => {
      table[s.id][b] = {};
      days.forEach((d) => (table[s.id][b][d] = YEHUDA_TABLE[s.id][i][d]));
    });
  });
  return normalizePricing({
    version: 2, tierBreak: 50, approvalPct: 0, rules: [], spaces: [{ id: "main", name: "אולם", adj: 0 }],
    seasons, brackets, days, minGuests: 300, guestsPerTable: 12, commission: 1, table,
    groups: [{ id: "bar", name: "בר", default: "pour" }, { id: "kosher", name: "כשרות מהודרת", default: "" }],
    addons: [
      addon({ id: "lighting", name: "הגברה ותאורה", price: 11500, on: true, monthPrices: { 1: 6000 } }),
      addon({ id: "pour", name: "שירותי מזיגה", price: 4000, group: "bar" }),
      addon({ id: "premium", name: "בר פרימיום", price: 40, unit: "person", group: "bar" }),
      addon({ id: "design", name: "עיצוב אולם ושולחנות", price: 6000, on: true, includedTables: 30, extraPerTable: 150 }),
      addon({ id: "mahfud", name: "מחפוד", price: 30, unit: "person", group: "kosher" }),
      addon({ id: "atara", name: "עטרה", price: 15, unit: "person", group: "kosher" }),
      addon({ id: "after", name: "אפטר פארטי", price: 0 }),
      addon({ id: "misc", name: "שונות (בריכה, תוספת שעה וכו׳)", price: 0 }),
    ],
  });
}

// ---------- ניקוי ואימות של כל מחירון שנטען ----------
export const HEB: [string, string, string][] = [
  ["omer", "ספירת העומר", "פרט ל״ג בעומר"], ["lag", "ל״ג בעומר", ""], ["bein", "בין המצרים", "י״ז בתמוז עד ט׳ באב"],
  ["av9", "תשעה באב", ""], ["gedalia", "צום גדליה", ""], ["tevet10", "עשרה בטבת", ""], ["esther", "תענית אסתר", ""],
];
const isISO = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePricing(d: any): Pricing {
  if (!d || typeof d !== "object" || d.version !== 2) return yehudaDefaults();
  const num = (v: unknown, def: number) => {
    const n = Number(v);
    return isFinite(n) && v !== "" && v != null ? n : def;
  };
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const seasons: PricingSeason[] = arr(d.seasons).map((s) => ({
    id: String(s.id || uid("s")), name: String(s.name || "עונה"),
    months: arr(s.months).map(Number).filter((m) => m >= 1 && m <= 12),
  }));
  const brackets = [...new Set(arr(d.brackets).map(Number).filter((n) => n > 0))].sort((a, b) => a - b);
  const days = [...new Set(arr(d.days).map(Number).filter((n) => n >= 0 && n <= 6))].sort();
  const table: Pricing["table"] = {};
  seasons.forEach((s) => {
    table[s.id] = {};
    brackets.forEach((b) => {
      table[s.id][b] = {};
      days.forEach((dd) => {
        const v = d.table?.[s.id]?.[b]?.[dd];
        table[s.id][b][dd] = v == null || v === "" ? null : +v;
      });
    });
  });
  const groups = arr(d.groups).map((g) => ({ id: String(g.id || uid("g")), name: String(g.name || "קבוצה"), default: String(g.default || "") }));
  const addons: PricingAddon[] = arr(d.addons).map((a) => {
    const mp: Record<number, number> = {};
    if (a.monthPrices && typeof a.monthPrices === "object")
      Object.keys(a.monthPrices).forEach((k) => {
        const m = +k, v = a.monthPrices[k];
        if (m >= 1 && m <= 12 && v !== "" && v != null && isFinite(+v)) mp[m] = +v;
      });
    const sp: Record<string, number> = {};
    if (a.seasonPrices && typeof a.seasonPrices === "object")
      Object.keys(a.seasonPrices).forEach((k) => {
        const v = a.seasonPrices[k];
        if (seasons.some((x) => x.id === k) && v !== "" && v != null && isFinite(+v)) sp[k] = +v;
      });
    // חריג חודש שיש לו תקופה של חודש אחד עובר להיות חריג תקופה
    Object.keys(mp).forEach((m) => {
      const one = seasons.find((x) => x.months.length === 1 && x.months[0] === +m);
      if (one && sp[one.id] == null) {
        sp[one.id] = mp[+m];
        delete mp[+m];
      }
    });
    return {
      id: String(a.id || uid("a")), name: String(a.name || "תוספת"), price: num(a.price, 0),
      unit: ["event", "person", "table"].includes(a.unit) ? a.unit : "event",
      group: groups.some((g) => g.id === a.group) ? a.group : "", on: !!a.on,
      monthPrices: mp, seasonPrices: sp, includedTables: num(a.includedTables, 0), extraPerTable: num(a.extraPerTable, 0),
    };
  });
  const rules: PricingRule[] = arr(d.rules).map((r) => {
    const sc = String(r.scope || "all");
    const okScope = sc === "all" || sc === "dates" || (sc.startsWith("s:") && seasons.some((x) => x.id === sc.slice(2))) ||
      (/^m:\d+$/.test(sc) && +sc.slice(2) >= 1 && +sc.slice(2) <= 12);
    const gv = (v: unknown) => (v === "" || v == null || !isFinite(+v!) || +v! <= 0 ? null : +v!);
    return {
      id: String(r.id || uid("r")), name: String(r.name || ""), scope: okScope ? sc : "all",
      days: arr(r.days).map(Number).filter((n) => n >= 0 && n <= 6), gMin: gv(r.gMin), gMax: gv(r.gMax),
      until: isISO(r.until) ? r.until : "", type: ["delta", "pct", "fixed"].includes(r.type) ? r.type : "delta",
      value: num(r.value, 0), on: okScope && r.on !== false,
      heb: arr(r.heb).filter((k) => HEB.some((h) => h[0] === k)),
      ranges: arr(r.ranges).filter((x) => x && isISO(x.from)).map((x) => ({ from: x.from, to: isISO(x.to) && x.to >= x.from ? x.to : x.from })),
    };
  });
  let spaces = arr(d.spaces).filter((x) => x && typeof x === "object")
    .map((x) => ({ id: String(x.id || uid("sp")), name: String(x.name || "").trim() || "חלל", adj: num(x.adj, 0) }));
  if (!spaces.length) spaces = [{ id: "main", name: "אולם", adj: 0 }];
  return {
    version: 2, minGuests: num(d.minGuests, 0), guestsPerTable: num(d.guestsPerTable, 12) || 12,
    commission: num(d.commission, 1), tierBreak: Math.min(100, Math.max(1, num(d.tierBreak, 50))),
    approvalPct: Math.max(0, num(d.approvalPct, 0)),
    seasons, brackets, days, table, groups, addons, rules, spaces,
  };
}

// ---------- מחירון ----------
export const seasonOf = (P: Pricing, m: number | null) => (m == null ? null : P.seasons.find((s) => s.months.includes(m)) || null);
export const tablesFor = (P: Pricing, g: number) => Math.ceil(g / (P.guestsPerTable || 12)) || 0;
export const spaceOf = (P: Pricing, id?: string) => P.spaces.find((x) => x.id === id) || P.spaces[0];

// מחיר מדרגה חל מנקודת השבר: tierBreak% מהמרווח מעל המדרגה הקודמת (50% בין 300 ל-350 = 325)
export function tierInfo(P: Pricing, g: number) {
  const bs = [...P.brackets].sort((a, b) => a - b);
  if (!bs.length) return null;
  const start = (k: number) => bs[k - 1] + (bs[k] - bs[k - 1]) * ((P.tierBreak || 50) / 100);
  let k = 0;
  for (let j = 1; j < bs.length; j++) if (g >= start(j)) k = j;
  return { b: bs[k], from: k > 0 ? start(k) : null, next: k < bs.length - 1 ? start(k + 1) : null };
}

export function listPrice(P: Pricing, m: number | null, d: number | null, g: number): number | null {
  if (m == null || d == null || !(g > 0)) return null;
  const s = seasonOf(P, m), t = tierInfo(P, g);
  if (!s || !t) return null;
  const v = P.table?.[s.id]?.[t.b]?.[d];
  return v == null ? null : +v;
}

// ---------- כללים ומבצעים ----------
function rulesFor(P: Pricing, m: number, d: number, g: number) {
  const t = todayISO();
  return P.rules.filter((r) => r.on && r.scope !== "dates" &&
    (r.scope === "all" || (r.scope.startsWith("s:") ? seasonOf(P, m)?.id === r.scope.slice(2) : +r.scope.slice(2) === m)) &&
    (!r.days.length || r.days.includes(d)) && (r.gMin == null || g >= r.gMin) && (r.gMax == null || g <= r.gMax) && (!r.until || r.until >= t));
}

const applyOne = (v: number, r: PricingRule) => (r.type === "fixed" ? r.value : r.type === "pct" ? v * (1 + r.value / 100) : v + r.value);

export function applyRules(P: Pricing, list: number | null, m: number | null, d: number | null, g: number) {
  if (m == null || d == null || !(g > 0)) return { price: list, applied: [] as PricingRule[] };
  const applied = rulesFor(P, m, d, g);
  let v = list;
  applied.forEach((r) => {
    if (r.type === "fixed") v = r.value;
    else if (v != null) v = applyOne(v, r);
  });
  return { price: v == null ? null : r2(v), applied };
}

// תקופות בלוח העברי, לכל שנה דרך Intl
const hebFmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { month: "long", day: "numeric" });
export function hebKeys(iso: string): string[] {
  const [y, mo, dd] = iso.split("-").map(Number);
  const p = hebFmt.formatToParts(new Date(y, mo - 1, dd, 12));
  const m = p.find((x) => x.type === "month")!.value, d = +p.find((x) => x.type === "day")!.value, k: string[] = [];
  if ((m === "Nisan" && d >= 16) || (m === "Iyar" && d !== 18) || (m === "Sivan" && d <= 5)) k.push("omer");
  if (m === "Iyar" && d === 18) k.push("lag");
  if ((m === "Tamuz" && d >= 17) || (m === "Av" && d <= 9)) k.push("bein");
  if (m === "Av" && d === 9) k.push("av9");
  if (m === "Tishri" && d === 3) k.push("gedalia");
  if (m === "Tevet" && d === 10) k.push("tevet10");
  if ((m === "Adar" || m === "Adar II") && d === 13) k.push("esther");
  return k;
}

// כללי תאריך (לוח עברי או טווחים) חלים רק כשנבחר תאריך מדויק
export function dateAdj(P: Pricing, iso: string, d: number, g: number, base: number) {
  const t = todayISO(), kk = hebKeys(iso);
  const rs = P.rules.filter((r) => r.on && r.scope === "dates" &&
    (r.heb.some((k) => kk.includes(k)) || r.ranges.some((x) => iso >= x.from && iso <= (x.to || x.from))) &&
    (!r.days.length || r.days.includes(d)) && (r.gMin == null || g >= r.gMin) && (r.gMax == null || g <= r.gMax) && (!r.until || r.until >= t));
  let v = base;
  rs.forEach((r) => (v = applyOne(v, r)));
  return { adj: r2(v - base), rules: rs };
}

// ---------- תוספות ----------
export function newAddonState(P: Pricing): AddonState {
  const on: Record<string, boolean> = {}, sel: Record<string, string> = {};
  P.addons.filter((a) => !a.group).forEach((a) => (on[a.id] = a.on));
  P.groups.forEach((g) => (sel[g.id] = g.default));
  return { on, sel, over: {} };
}

export const cloneState = (st: AddonState): AddonState => JSON.parse(JSON.stringify(st));

export function isOn(a: PricingAddon, st: AddonState) {
  return a.group ? st.sel[a.group] === a.id : !!st.on[a.id];
}

export function basePrice(P: Pricing, a: PricingAddon, m: number | null) {
  if (m != null && a.monthPrices[m] != null) return a.monthPrices[m];
  const sid = seasonOf(P, m)?.id, sp = sid ? a.seasonPrices[sid] : undefined;
  return sp != null ? sp : a.price || 0;
}

export const unitPrice = (P: Pricing, a: PricingAddon, m: number | null, st: AddonState) =>
  st.over[a.id] != null ? st.over[a.id] : basePrice(P, a, m);

export function addonQty(P: Pricing, a: PricingAddon, g: number) {
  return a.unit === "person" ? g : a.unit === "table" ? tablesFor(P, g) : 1;
}

export function extrasOf(P: Pricing, a: PricingAddon, g: number) {
  if (!(a.includedTables > 0 && a.extraPerTable > 0)) return 0;
  return Math.max(0, tablesFor(P, g) - a.includedTables) * a.extraPerTable;
}

export function costOf(P: Pricing, a: PricingAddon, m: number | null, g: number, st: AddonState) {
  return unitPrice(P, a, m, st) * addonQty(P, a, g) + extrasOf(P, a, g);
}

// ---------- תאריך אחד ----------
export function compute(P: Pricing, opt: PricingOption, g: number, extra: PricingAddon[] = []): OptionResult {
  const ar = applyRules(P, listPrice(P, opt.month, opt.day, g), opt.month, opt.day, g);
  const list = ar.price == null ? null : ar.price + (spaceOf(P, opt.space)?.adj || 0);
  const cost: Record<string, number> = {};
  P.addons.concat(extra).forEach((a) => (cost[a.id] = isOn(a, opt.st) ? costOf(P, a, opt.month, g, opt.st) : 0));
  const add = Object.values(cost).reduce((x, y) => x + y, 0), addPP = g > 0 ? add / g : 0;
  // מצב תקציב: הזוג אמר כמה הוא משלם למנה הכל כלול → מחיר המנה הוא מה שנשאר אחרי התוספות
  const fromTarget = !!opt.ai && (opt.target ?? 0) > 0 && g > 0;
  const base = fromTarget ? r2(opt.target! - addPP) : opt.manual != null ? opt.manual : list ?? 0;
  const per = base + addPP;
  return {
    guests: g, list, base, cost, add, addPP, per, total: per * g,
    ok: g > 0 && (list != null || opt.manual != null || fromTarget),
    season: seasonOf(P, opt.month), rules: ar.applied, fromTarget, priced: fromTarget || opt.manual != null,
  };
}

// מחיר מנה מול המחירון, לתג "+X% / −X%"
export function diffFromList(base: number, list: number | null) {
  if (list == null || !list) return null;
  const d = r2(base - list);
  return { d, pct: (d / list) * 100 };
}

export const commissionOf = (P: Pricing, total: number) => r2((total * (P.commission || 0)) / 100);

/** אחוז ההנחה מהמחירון (שלילי = מתחת), ו"צריך אישור" כשההנחה עוברת את הסף בהגדרות */
export function discountOf(P: Pricing, opt: PricingOption, g: number): { pct: number | null; needs: boolean } {
  const r = compute(P, opt, g);
  const pct = r.list ? r2(((r.base - r.list) / r.list) * 100) : null;
  return { pct, needs: P.approvalPct > 0 && pct != null && pct <= -P.approvalPct };
}

/** האם התאריך חסום עד אישור מנהל (אישור קודם תקף רק לאותו מחיר מנה) */
export function blockedByApproval(P: Pricing, opt: PricingOption, g: number): boolean {
  if (!discountOf(P, opt, g).needs) return false;
  return !(opt.approval?.status === "approved" && opt.approval.base === compute(P, opt, g).base);
}
