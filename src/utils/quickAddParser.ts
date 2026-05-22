import type { Category } from '../types';
import { formatDate } from './date';

// ─── Public types ────────────────────────────────────────────────────────────

export interface ParsedTransactionDraft {
  type: 'EXPENSE' | 'INCOME';
  title: string;
  category: string;
  amount: number;
  currency: string;
  date: string;       // yyyy-MM-dd  (for internal use / saving)
  note: string;
  confidence: number; // 0–1
}

export type ParseResult =
  | { ok: true; draft: ParsedTransactionDraft }
  | { ok: false; error: string };

// ─── Month name map ──────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

// ─── Default keyword → category mapping ──────────────────────────────────────

const KEYWORD_CATEGORY: Record<string, string> = {
  // Food
  food: 'Food', lunch: 'Food', breakfast: 'Food', dinner: 'Food',
  tea: 'Food', coffee: 'Food', snacks: 'Food', milk: 'Food',
  egg: 'Food', eggs: 'Food', paneer: 'Food', chicken: 'Food',
  dosa: 'Food', chapati: 'Food', groceries: 'Food', grocery: 'Food',
  restaurant: 'Food', hotel: 'Food', swiggy: 'Food', zomato: 'Food',
  biryani: 'Food', pizza: 'Food', burger: 'Food', juice: 'Food',
  // Zepto
  zepto: 'Zepto',
  // Personal
  haircut: 'Personal', grooming: 'Personal', salon: 'Personal',
  personal: 'Personal', gym: 'Personal', barber: 'Personal', spa: 'Personal',
  // Fuel
  petrol: 'Fuel', diesel: 'Fuel', fuel: 'Fuel',
  // Travel
  bus: 'Travel', train: 'Travel', auto: 'Travel', taxi: 'Travel',
  uber: 'Travel', ola: 'Travel', travel: 'Travel', metro: 'Travel',
  cab: 'Travel', flight: 'Travel', rapido: 'Travel',
  // Rent
  rent: 'Rent',
  // Bills
  bill: 'Bills', bills: 'Bills', electricity: 'Bills', recharge: 'Bills',
  wifi: 'Bills', internet: 'Bills', mobile: 'Bills', dth: 'Bills', gas: 'Bills',
  // Health
  medicine: 'Health', hospital: 'Health', doctor: 'Health',
  medical: 'Health', pharmacy: 'Health', health: 'Health',
  // Entertainment
  movie: 'Entertainment', cinema: 'Entertainment', game: 'Entertainment',
  games: 'Entertainment', netflix: 'Entertainment', entertainment: 'Entertainment',
  // Shopping
  shopping: 'Shopping', amazon: 'Shopping', flipkart: 'Shopping',
  clothes: 'Shopping', clothing: 'Shopping', myntra: 'Shopping',
  // Income
  salary: 'Income', income: 'Income', received: 'Income',
  credited: 'Income', refund: 'Income', freelance: 'Income', bonus: 'Income',
};

/** Words that should be placed in note instead of title/category */
const TIME_WORDS = new Set(['morning', 'evening', 'night', 'afternoon', 'noon', 'midnight']);

/** Income signal words */
const INCOME_WORDS = new Set([
  'salary', 'income', 'received', 'credited', 'refund',
  'freelance', 'bonus', 'payment received',
]);

/** Currency words that must never be mistaken for amounts or titles */
const CURRENCY_WORDS = new Set([
  'rs', 'rs.', 'inr', 'rupees', 'rupee',
  'usd', 'dollars', 'dollar', 'eur', 'euros', 'euro',
  'gbp', 'pounds', 'pound',
]);

/** Date-context words that must be stripped from title/category consideration */
const DATE_NOISE = new Set([
  'today', 'yesterday', 'current', 'now', 'on', 'at',
  'jan', 'january', 'feb', 'february', 'mar', 'march',
  'apr', 'april', 'may', 'jun', 'june', 'jul', 'july',
  'aug', 'august', 'sep', 'sept', 'september', 'oct', 'october',
  'nov', 'november', 'dec', 'december',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return formatDate(Date.now());
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d.getTime());
}

function currentYear(): number {
  return new Date().getFullYear();
}

function padded(n: number): string {
  return String(n).padStart(2, '0');
}

function makeDate(y: number, m: number, d: number): string {
  return `${y}-${padded(m)}-${padded(d)}`;
}

function isValidDay(d: number): boolean {
  return d >= 1 && d <= 31;
}

function isValidMonth(m: number): boolean {
  return m >= 1 && m <= 12;
}

function isValidYear(y: number): boolean {
  return y >= 2000 && y <= 2099;
}

// ─── Phase 1: Currency-marked amount extraction ───────────────────────────────

interface AmountResult {
  amount: number | null;
  usedIndices: Set<number>;
  currency: string | null;
}

/**
 * Scans the raw input string for currency-attached amount patterns BEFORE
 * tokenisation so we can handle `₹20`, `₹ 20`, `20rs`, `rs 20`, `20 rupees`.
 *
 * Returns the first currency-marked amount found and its approximate token
 * indices so they can be excluded from later scans.
 *
 * We re-use the token array for index tracking.
 */
function parseCurrencyAmount(tokens: string[]): AmountResult {
  // Patterns that directly attach currency to the number in a single token
  const singleTokenPatterns: Array<{
    re: RegExp;
    currency: string;
    group: number; // which capture group holds the number
  }> = [
    // ₹20  ₹20.50
    { re: /^₹(\d+(?:\.\d+)?)$/, currency: 'INR', group: 1 },
    // rs20  rs.20
    { re: /^rs\.?(\d+(?:\.\d+)?)$/i, currency: 'INR', group: 1 },
    // inr20
    { re: /^inr(\d+(?:\.\d+)?)$/i, currency: 'INR', group: 1 },
    // 20rs  20rs.
    { re: /^(\d+(?:\.\d+)?)rs\.?$/i, currency: 'INR', group: 1 },
    // 20inr
    { re: /^(\d+(?:\.\d+)?)inr$/i, currency: 'INR', group: 1 },
    // $20
    { re: /^\$(\d+(?:\.\d+)?)$/, currency: 'USD', group: 1 },
    // €20
    { re: /^€(\d+(?:\.\d+)?)$/, currency: 'EUR', group: 1 },
    // £20
    { re: /^£(\d+(?:\.\d+)?)$/, currency: 'GBP', group: 1 },
  ];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // Single-token currency patterns
    for (const pat of singleTokenPatterns) {
      const m = tok.match(pat.re);
      if (m) {
        const n = parseFloat(m[pat.group]);
        if (n > 0) {
          return { amount: n, usedIndices: new Set([i]), currency: pat.currency };
        }
      }
    }

    // Two-token: "₹" then number  (when ₹ and number are separate tokens)
    if (tok === '₹' && i + 1 < tokens.length) {
      const n = parseFloat(tokens[i + 1]);
      if (n > 0) {
        return { amount: n, usedIndices: new Set([i, i + 1]), currency: 'INR' };
      }
    }

    // Two-token: "rs" / "rs." / "inr" then number
    if (/^(rs\.?|inr)$/i.test(tok) && i + 1 < tokens.length) {
      const n = parseFloat(tokens[i + 1]);
      if (n > 0) {
        return { amount: n, usedIndices: new Set([i, i + 1]), currency: 'INR' };
      }
    }

    // Two-token: number then "rupees" / "rupee" / "rs" / "inr"
    if (/^\d+(?:\.\d+)?$/.test(tok) && i + 1 < tokens.length) {
      const next = tokens[i + 1].toLowerCase();
      if (/^(rupees?|rs\.?|inr)$/.test(next)) {
        const n = parseFloat(tok);
        if (n > 0) {
          return { amount: n, usedIndices: new Set([i, i + 1]), currency: 'INR' };
        }
      }
    }
  }

  return { amount: null, usedIndices: new Set(), currency: null };
}

// ─── Phase 2: Natural date extraction ────────────────────────────────────────

interface DateResult {
  dateStr: string; // yyyy-MM-dd
  usedIndices: Set<number>;
}

/**
 * Tries to find a date in the token list using priority order:
 *  1. yyyy-MM-dd (ISO)
 *  2. dd/MM/yyyy, dd-MM-yyyy, dd.MM.yyyy
 *  3. MonthName Day [Year]
 *  4. Day MonthName [Year]
 *  5. today / current / yesterday
 *  6. fallback → today
 *
 * `excludedIndices` are indices already consumed by the amount scan.
 */
function parseNaturalDate(tokens: string[], excludedIndices: Set<number>): DateResult {
  const today = todayStr();
  const yr = currentYear();

  // Helper: can a token index be used?
  const available = (i: number) => !excludedIndices.has(i);

  // ── 1. ISO yyyy-MM-dd ──────────────────────────────────────────────────────
  for (let i = 0; i < tokens.length; i++) {
    if (!available(i)) continue;
    const m = tokens[i].match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, y, mo, d] = m.map(Number);
      if (isValidYear(y) && isValidMonth(mo) && isValidDay(d)) {
        return { dateStr: makeDate(y, mo, d), usedIndices: new Set([i]) };
      }
    }
  }

  // ── 2. dd/MM/yyyy, dd-MM-yyyy, dd.MM.yyyy ─────────────────────────────────
  for (let i = 0; i < tokens.length; i++) {
    if (!available(i)) continue;
    const m = tokens[i].match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
      const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
      if (isValidDay(d) && isValidMonth(mo) && isValidYear(y)) {
        return { dateStr: makeDate(y, mo, d), usedIndices: new Set([i]) };
      }
    }
  }

  // ── 3. MonthName Day [Year]  (e.g. "may 20", "may 20 2026", "on may 20") ──
  for (let i = 0; i < tokens.length; i++) {
    if (!available(i)) continue;

    // Skip the word "on" — look ahead
    let mi = i;
    if (tokens[mi] === 'on' && mi + 1 < tokens.length) mi++;

    const monthNum = MONTH_MAP[tokens[mi]];
    if (monthNum === undefined) continue;

    // Need a day number next
    const dayIdx = mi + 1;
    if (dayIdx >= tokens.length || !available(dayIdx)) continue;
    const dayNum = parseInt(tokens[dayIdx], 10);
    if (isNaN(dayNum) || !isValidDay(dayNum) || !/^\d{1,2}$/.test(tokens[dayIdx])) continue;

    // Optional year
    const yearIdx = mi + 2;
    let y = yr;
    const usedIdx = new Set<number>([mi, dayIdx]);
    if (tokens[mi] !== tokens[i]) usedIdx.add(i); // consumed "on"

    if (yearIdx < tokens.length && available(yearIdx)) {
      const maybeYear = parseInt(tokens[yearIdx], 10);
      if (isValidYear(maybeYear) && /^\d{4}$/.test(tokens[yearIdx])) {
        y = maybeYear;
        usedIdx.add(yearIdx);
      }
    }

    return { dateStr: makeDate(y, monthNum, dayNum), usedIndices: usedIdx };
  }

  // ── 4. Day MonthName [Year]  (e.g. "20 may", "20 may 2026", "on 20 may") ──
  for (let i = 0; i < tokens.length; i++) {
    if (!available(i)) continue;

    let si = i;
    if (tokens[si] === 'on' && si + 1 < tokens.length) si++;

    // Expect day number first
    if (!/^\d{1,2}$/.test(tokens[si])) continue;
    const dayNum = parseInt(tokens[si], 10);
    if (!isValidDay(dayNum)) continue;

    // Expect month name next
    const monthIdx = si + 1;
    if (monthIdx >= tokens.length || !available(monthIdx)) continue;
    const monthNum = MONTH_MAP[tokens[monthIdx]];
    if (monthNum === undefined) continue;

    // Optional year
    const yearIdx = si + 2;
    let y = yr;
    const usedIdx = new Set<number>([si, monthIdx]);
    if (tokens[si] !== tokens[i]) usedIdx.add(i); // "on" consumed

    if (yearIdx < tokens.length && available(yearIdx)) {
      const maybeYear = parseInt(tokens[yearIdx], 10);
      if (isValidYear(maybeYear) && /^\d{4}$/.test(tokens[yearIdx])) {
        y = maybeYear;
        usedIdx.add(yearIdx);
      }
    }

    return { dateStr: makeDate(y, monthNum, dayNum), usedIndices: usedIdx };
  }

  // ── 5. Relative words ──────────────────────────────────────────────────────
  for (let i = 0; i < tokens.length; i++) {
    if (!available(i)) continue;
    if (tokens[i] === 'today' || tokens[i] === 'current' || tokens[i] === 'now') {
      return { dateStr: today, usedIndices: new Set([i]) };
    }
    if (tokens[i] === 'yesterday') {
      return { dateStr: yesterdayStr(), usedIndices: new Set([i]) };
    }
  }

  // ── 6. Fallback ────────────────────────────────────────────────────────────
  return { dateStr: today, usedIndices: new Set() };
}

// ─── Category / title helpers ─────────────────────────────────────────────────

function resolveCategory(
  words: string[],
  profileCategories: Category[],
): { category: string; matchedKeyword: string | null } {

  const inputLower = words.join(' ');

  // 1. User-created / profile categories — avoid < 3-char names to prevent false matches
  for (const cat of profileCategories) {
    if (cat.name.length < 3) continue;
    const catLower = cat.name.toLowerCase();
    // Exact word match first
    if (words.some((w) => w === catLower)) {
      return { category: cat.name, matchedKeyword: cat.name };
    }
  }
  // Then partial contains
  for (const cat of profileCategories) {
    if (cat.name.length < 3) continue;
    const catLower = cat.name.toLowerCase();
    if (inputLower.includes(catLower)) {
      return { category: cat.name, matchedKeyword: cat.name };
    }
  }

  // 2. Keyword → built-in category
  for (const word of words) {
    const mapped = KEYWORD_CATEGORY[word];
    if (mapped) return { category: mapped, matchedKeyword: word };
  }
  // Substring scan for multi-word input
  for (const [kw, cat] of Object.entries(KEYWORD_CATEGORY)) {
    if (inputLower.includes(kw)) return { category: cat, matchedKeyword: kw };
  }

  // 3. Fallback
  return { category: 'Other', matchedKeyword: null };
}

function deriveTitle(words: string[], matchedKeyword: string | null): string {
  if (matchedKeyword) {
    return matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1);
  }
  const candidate = words.find(
    (w) => !TIME_WORDS.has(w) && !/^\d/.test(w) && w.length >= 2,
  );
  return candidate
    ? candidate.charAt(0).toUpperCase() + candidate.slice(1)
    : 'Entry';
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * parseQuickAdd — local rule-based parser, no external API.
 *
 * Handles natural amount formats: ₹20, 20rs, rs 20, 20 rupees, 20.50
 * Handles natural date formats: may 20, 20 may 2026, 20/05/2026, 2026-05-20, today, yesterday
 * Correctly resolves ambiguous "lunch 20 may 20" as amount=20, date=May 20 current year.
 *
 * @param input             Raw user text, e.g. "food 60 morning"
 * @param defaultCurrency   e.g. "INR"
 * @param todayDate         Today in yyyy-MM-dd (pass formatDate(Date.now()))
 * @param availableCategories  Profile categoryObjects (user-created first)
 */
export function parseQuickAdd(
  input: string,
  defaultCurrency: string,
  _todayDate: string,
  availableCategories: Category[],
): ParseResult {

  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Please type something. Example: food 60' };

  // ── Tokenise ──────────────────────────────────────────────────────────────
  // Preserve dots in numbers (20.50) but normalise separators
  const tokens = raw
    .toLowerCase()
    .replace(/[₹$€£]/g, (c) => ` ${c} `) // separate currency symbols
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  // ── Phase 1: Currency-marked amount ──────────────────────────────────────
  const amtResult = parseCurrencyAmount(tokens);
  let amount: number | null = amtResult.amount;
  let detectedCurrency = amtResult.currency ?? defaultCurrency;
  const amountUsed = new Set(amtResult.usedIndices);

  // ── Phase 2: Natural date ─────────────────────────────────────────────────
  const dateResult = parseNaturalDate(tokens, amountUsed);
  const date = dateResult.dateStr;
  const dateUsed = new Set(dateResult.usedIndices);

  // ── Phase 3: Bare number fallback (if no currency-marked amount) ──────────
  if (amount === null) {
    for (let i = 0; i < tokens.length; i++) {
      if (amountUsed.has(i) || dateUsed.has(i)) continue;
      const tok = tokens[i];
      // Match a plain number (possibly with decimal) — not a year
      if (/^\d+(?:\.\d+)?$/.test(tok)) {
        const n = parseFloat(tok);
        // Reject values that look like years
        if (n > 0 && !(n >= 2000 && n <= 2099 && /^\d{4}$/.test(tok))) {
          amount = n;
          amountUsed.add(i);
          break;
        }
      }
    }
  }

  if (amount === null) {
    return { ok: false, error: 'Please include an amount. Example: lunch 20' };
  }

  // ── Build semantic token list (exclude amount + date + noise) ─────────────
  const allUsed = new Set([...amountUsed, ...dateUsed]);
  const semanticTokens = tokens.filter((tok, i) => {
    if (allUsed.has(i)) return false;
    if (CURRENCY_WORDS.has(tok)) return false;
    if (DATE_NOISE.has(tok)) return false;
    return true;
  });

  // ── Time words → note ──────────────────────────────────────────────────────
  const noteWords: string[] = [];
  const keywordTokens: string[] = [];

  for (const tok of semanticTokens) {
    if (TIME_WORDS.has(tok)) {
      noteWords.push(tok);
    } else {
      keywordTokens.push(tok);
    }
  }

  const noteStr = noteWords.join(' ');

  // ── Income detection ───────────────────────────────────────────────────────
  const isIncome = keywordTokens.some((t) => INCOME_WORDS.has(t)) ||
    raw.toLowerCase().includes('payment received');

  // ── Category & title ───────────────────────────────────────────────────────
  let category: string;
  let matchedKeyword: string | null;

  if (isIncome) {
    category = 'Income';
    matchedKeyword = keywordTokens.find((t) => INCOME_WORDS.has(t)) || null;
  } else {
    const result = resolveCategory(keywordTokens, availableCategories);
    category = result.category;
    matchedKeyword = result.matchedKeyword;
  }

  const title = deriveTitle(keywordTokens, matchedKeyword);

  // ── Confidence heuristic ───────────────────────────────────────────────────
  const confidence = matchedKeyword !== null ? 0.85 : 0.5;

  return {
    ok: true,
    draft: {
      type: isIncome ? 'INCOME' : 'EXPENSE',
      title,
      category,
      amount,
      currency: detectedCurrency,
      date,
      note: noteStr,
      confidence,
    },
  };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** yyyy-MM-dd → dd/MM/yyyy (for display only) */
export function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}
