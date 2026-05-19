import jsPDF from 'jspdf';
import type { ExpenseAppData, ExpenseProfile, TransactionType } from '../types';
import { convertAmount } from './currency';
import { formatDate } from './date';
import { formatMoney } from './money';

function downloadBlob(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '').replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

export async function exportCsv(profile: ExpenseProfile, displayCurrency: string) {
  const rows = ['Profile,Date,Type,Title,Category,Base Amount,Base Currency,Converted Amount,Display Currency,Note'];
  for (const t of profile.transactions) {
    const sign = t.type === 'EXPENSE' ? '-' : '';
    const converted = await convertAmount(t.amount, t.baseCurrency, displayCurrency);
    rows.push([
      profile.name,
      formatDate(t.dateMillis),
      t.type,
      t.title,
      t.category,
      `${sign}${t.amount}`,
      t.baseCurrency,
      `${sign}${converted}`,
      displayCurrency,
      t.note
    ].map(csvEscape).join(','));
  }
  downloadBlob(`expense_report_${profile.name.replace(/\s+/g, '_')}.csv`, rows.join('\n'), 'text/csv;charset=utf-8');
}

export function exportPdf(appData: ExpenseAppData, profile: ExpenseProfile) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  let y = 52;

  const totals = profile.transactions.reduce<Record<TransactionType | 'BALANCE', number>>((acc, t) => {
    if (t.type === 'EXPENSE') acc.EXPENSE += t.amount;
    else acc.INCOME += t.amount;
    acc.BALANCE = acc.INCOME - acc.EXPENSE;
    return acc;
  }, { EXPENSE: 0, INCOME: 0, BALANCE: 0 });

  function line(text: string, size = 11, color = '#344054', gap = 18, bold = false) {
    if (y > 790) { doc.addPage(); y = 50; }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(text, margin, y);
    y += gap;
  }

  doc.setFillColor('#EAF2FF');
  doc.roundedRect(margin, 30, pageWidth - margin * 2, 92, 18, 18, 'F');
  y = 62;
  line('Expense Tracker Report', 22, '#2563EB', 26, true);
  line(`Profile: ${profile.name}`, 12, '#101828', 17, true);
  line(`Currency: ${appData.currencyCode}   Generated: ${formatDate(Date.now())}`, 10, '#667085', 26);

  line('Summary', 15, '#101828', 22, true);
  line(`Total Income: ${formatMoney(totals.INCOME, appData.currencyCode)}`, 12, '#059669');
  line(`Total Expense: ${formatMoney(totals.EXPENSE, appData.currencyCode)}`, 12, '#DC2626');
  line(`Balance: ${formatMoney(totals.BALANCE, appData.currencyCode)}`, 12, '#2563EB', 26, true);

  line('Transactions', 15, '#101828', 22, true);
  const sorted = [...profile.transactions].sort((a, b) => b.dateMillis - a.dateMillis);
  if (!sorted.length) line('No transactions yet.', 11, '#667085');
  for (const t of sorted) {
    const prefix = t.type === 'EXPENSE' ? '-' : '+';
    const amount = `${prefix} ${formatMoney(t.amount, appData.currencyCode)}`;
    line(`${formatDate(t.dateMillis)} | ${t.type} | ${t.title} | ${t.category} | ${amount}`, 9.5, '#344054', 14);
    if (t.note) line(`Note: ${t.note}`, 8.5, '#667085', 12);
  }

  doc.save(`expense_report_${profile.name.replace(/\s+/g, '_')}.pdf`);
}
