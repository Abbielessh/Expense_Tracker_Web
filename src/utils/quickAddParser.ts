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

// ─── Default keyword → category mapping ──────────────────────────────────────

/** Maps keyword → canonical category name (must match defaultCategoryObjects names) */
const KEYWORD_CATEGORY: Record<string, string> = {
  // Food
  food: 'Food', lunch: 'Food', breakfast: 'Food', dinner: 'Food',
  tea: 'Food', coffee: 'Food', snacks: 'Food', milk: 'Food',
  egg: 'Food', eggs: 'Food', paneer: 'Food', chicken: 'Food',
  dosa: 'Food', chapati: 'Food', groceries: 'Food', grocery: 'Food',
  restaurant: 'Food', hotel: 'Food', swiggy: 'Food', zomato: 'Food',
  // Zepto
  zepto: 'Zepto',
  // Personal
  haircut: 'Personal', grooming: 'Personal', salon: 'Personal',
  personal: 'Personal', gym: 'Personal',
  // Fuel
  petrol: 'Fuel', diesel: 'Fuel', fuel: 'Fuel',
  // Travel
  bus: 'Travel', train: 'Travel', auto: 'Travel', taxi: 'Travel',
  uber: 'Travel', ola: 'Travel', travel: 'Travel', metro: 'Travel', cab: 'Travel',
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
  shopping: 'Shopping', amazon: 'Shopping', flipkart: 'Shopping', clothes: 'Shopping',
  clothing: 'Shopping',
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

// ─── Currency prefix patterns ─────────────────────────────────────────────────

const CURRENCY_PREFIX_RE = /^(₹|rs\.?|inr|usd|eur|gbp|\$|€|£)\s*/i;
const CURRENCY_SUFFIX_RE = /\s*(rupees?|dollars?|euros?|pounds?)$/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return formatDate(Date.now());
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d.getTime());
}

/**
 * Tries to match profile categories first (user-created), then falls back to
 * built-in keyword mapping, then 'Other'.
 */
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
    if (catLower.includes(inputLower.slice(0, Math.max(catLower.length, 3)))) {
      // input contains beginning of category — weak, skip
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

/**
 * Picks the best title from the input words, favouring the matched keyword,
 * stripping numbers/currencies/time words.
 */
function deriveTitle(words: string[], matchedKeyword: string | null): string {
  if (matchedKeyword) {
    return matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1);
  }
  // First non-number, non-time word
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

  // ── 1. Extract currency prefix / suffix ────────────────────────────────────
  let workingText = raw;
  let detectedCurrency = defaultCurrency;

  const prefixMatch = workingText.match(CURRENCY_PREFIX_RE);
  if (prefixMatch) {
    const sym = prefixMatch[1].toLowerCase();
    if (sym === '₹' || sym === 'rs' || sym === 'rs.' || sym === 'inr') detectedCurrency = 'INR';
    else if (sym === '$' || sym === 'usd') detectedCurrency = 'USD';
    else if (sym === '€' || sym === 'eur') detectedCurrency = 'EUR';
    else if (sym === '£' || sym === 'gbp') detectedCurrency = 'GBP';
    workingText = workingText.slice(prefixMatch[0].length);
  }

  const suffixMatch = workingText.match(CURRENCY_SUFFIX_RE);
  if (suffixMatch) {
    const suf = suffixMatch[1].toLowerCase();
    if (suf.startsWith('rupee')) detectedCurrency = 'INR';
    else if (suf.startsWith('dollar')) detectedCurrency = 'USD';
    else if (suf.startsWith('euro')) detectedCurrency = 'EUR';
    else if (suf.startsWith('pound')) detectedCurrency = 'GBP';
    workingText = workingText.slice(0, workingText.length - suffixMatch[0].length);
  }

  // ── 2. Tokenise ────────────────────────────────────────────────────────────
  const tokens = workingText
    .toLowerCase()
    .replace(/[^\w\s.]/g, ' ')   // keep dots for decimals
    .split(/\s+/)
    .filter(Boolean);

  // ── 3. Extract amount (first valid positive number) ───────────────────────
  let amount: number | null = null;
  const nonAmountTokens: string[] = [];

  for (const tok of tokens) {
    if (amount === null && /^\d+(\.\d+)?$/.test(tok)) {
      const n = parseFloat(tok);
      if (n > 0) { amount = n; continue; }
    }
    nonAmountTokens.push(tok);
  }

  if (amount === null) {
    return { ok: false, error: 'Please include an amount. Example: food 60' };
  }

  // ── 4. Date detection ──────────────────────────────────────────────────────
  let date = todayStr();
  const dateFilteredTokens: string[] = [];

  for (const tok of nonAmountTokens) {
    if (tok === 'today' || tok === 'current' || tok === 'now') {
      date = todayStr();
    } else if (tok === 'yesterday') {
      date = yesterdayStr();
    } else {
      dateFilteredTokens.push(tok);
    }
  }

  // ── 5. Time words → note ──────────────────────────────────────────────────
  const noteWords: string[] = [];
  const keywordTokens: string[] = [];

  for (const tok of dateFilteredTokens) {
    if (TIME_WORDS.has(tok)) {
      noteWords.push(tok);
    } else {
      keywordTokens.push(tok);
    }
  }

  const noteStr = noteWords.join(' ');

  // ── 6. Income detection ───────────────────────────────────────────────────
  const isIncome = keywordTokens.some((t) => INCOME_WORDS.has(t)) ||
    raw.toLowerCase().includes('payment received');

  // ── 7. Category & title ───────────────────────────────────────────────────
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

  // ── 8. Confidence heuristic ───────────────────────────────────────────────
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
