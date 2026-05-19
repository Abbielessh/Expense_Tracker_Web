const rateCache = new Map<string, number>();

export const commonCurrencies = [
  'INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'JPY', 'CAD', 'AUD', 'SGD',
  'CHF', 'CNY', 'MYR', 'THB', 'LKR', 'BDT', 'PKR', 'NPR', 'ZAR', 'BRL'
];

export async function getRate(from: string, to: string): Promise<number> {
  const source = from.toUpperCase();
  const target = to.toUpperCase();
  if (source === target) return 1;
  const cacheKey = `${source}_${target}`;
  const existing = rateCache.get(cacheKey);
  if (existing) return existing;

  try {
    const res = await fetch(`https://api.frankfurter.dev/v2/latest?base=${encodeURIComponent(source)}&symbols=${encodeURIComponent(target)}`);
    if (!res.ok) throw new Error(`Currency request failed: ${res.status}`);
    const json = await res.json() as { rates?: Record<string, number> };
    const rate = json.rates?.[target] ?? 1;
    rateCache.set(cacheKey, rate);
    if (rate !== 0) rateCache.set(`${target}_${source}`, 1 / rate);
    return rate;
  } catch {
    return 1;
  }
}

export async function convertAmount(amount: number, from: string, to: string): Promise<number> {
  return amount * await getRate(from, to);
}

export function getRateSync(from: string, to: string): number {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  return rateCache.get(`${from.toUpperCase()}_${to.toUpperCase()}`) ?? 1;
}
