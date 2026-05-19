import type { MoneyTransaction } from '../types';
import { getRateSync } from './currency';

export function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode.toUpperCase() }).format(amount);
  } catch {
    return `${currencyCode.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

export function convertedAmount(t: MoneyTransaction, targetCurrency: string): number {
  return t.amount * getRateSync(t.baseCurrency, targetCurrency);
}

export function sumBetween(transactions: MoneyTransaction[], startMillis: number, endMillis: number, currencyCode: string): number {
  return transactions
    .filter((t) => t.dateMillis >= startMillis && t.dateMillis <= endMillis)
    .reduce((sum, t) => sum + convertedAmount(t, currencyCode), 0);
}
