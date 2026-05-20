import jsPDF from 'jspdf';
import type { ExpenseAppData, ExpenseProfile, MoneyTransaction } from '../types';
import { convertAmount } from './currency';
import { formatDate } from './date';
import { convertedAmount, formatMoney } from './money';

// ─── Split type ────────────────────────────────────────────────────────────────
export type PdfSplitType = 'FULL' | 'DAY' | 'WEEK' | 'MONTH';

export const PDF_SPLIT_LABELS: Record<PdfSplitType, string> = {
  FULL: 'Full Report',
  DAY: 'Day-wise Split',
  WEEK: 'Week-wise Split',
  MONTH: 'Month-wise Split',
};

// ─── Download helper ───────────────────────────────────────────────────────────
function downloadBlob(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV escape ────────────────────────────────────────────────────────────────
function csvEscape(value: unknown): string {
  const text = String(value ?? '').replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

// ─── CSV export (unchanged) ────────────────────────────────────────────────────
export async function exportCsv(profile: ExpenseProfile, displayCurrency: string) {
  const rows = ['Profile,Date,Type,Title,Category,Base Amount,Base Currency,Converted Amount,Display Currency,Note'];
  for (const t of profile.transactions) {
    const sign = t.type === 'EXPENSE' ? '-' : '';
    const converted = await convertAmount(t.amount, t.baseCurrency, displayCurrency);
    rows.push(
      [
        profile.name,
        formatDate(t.dateMillis),
        t.type,
        t.title,
        t.category,
        `${sign}${t.amount}`,
        t.baseCurrency,
        `${sign}${converted}`,
        displayCurrency,
        t.note,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  downloadBlob(
    `expense_report_${profile.name.replace(/\s+/g, '_')}.csv`,
    rows.join('\n'),
    'text/csv;charset=utf-8',
  );
}

// ─── PDF export ────────────────────────────────────────────────────────────────

// Color palette (matching Android PdfUtils.kt)
const C = {
  primary: '#2563EB',
  green: '#059669',
  red: '#DC2626',
  gray: '#667085',
  dark: '#101828',
  lightBg: '#EDF4FF',
  accent: '#10B981',
  lightGreen: '#ECFDF5',
  lightRed: '#FEF2F2',
  lightBlue: '#EFF6FF',
  rowAlt: '#F8FAFF',
  white: '#FFFFFF',
  divider: '#DCE1EB',
  bannerSub: '#BAD2FF',
  groupHeader: '#DCEBFF',
  groupTotal: '#FFF2F2',
  bodyText: '#344054',
};

function formatDisplayDate(millis: number): string {
  const d = new Date(millis);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  return `${day}/${mon}/${yr}`;
}

function formatDateTime(millis: number): string {
  const d = new Date(millis);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  const hr = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${mon}/${yr} ${hr}:${min}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function exportPdf(
  appData: ExpenseAppData,
  profile: ExpenseProfile,
  splitType: PdfSplitType = 'FULL',
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const PW = doc.internal.pageSize.getWidth();   // 595.28
  const PH = doc.internal.pageSize.getHeight();  // 841.89
  const margin = 36;
  const contentW = PW - margin * 2;
  let y = 0;
  let pageNumber = 1;
  const currencyCode = appData.currencyCode;
  const now = Date.now();

  // ── Helper: set fill color from hex ─────────────────────────────────────────
  function setFill(hex: string) {
    doc.setFillColor(...hexToRgb(hex));
  }
  function setTextColor(hex: string) {
    doc.setTextColor(...hexToRgb(hex));
  }
  function setDrawColor(hex: string) {
    doc.setDrawColor(...hexToRgb(hex));
  }

  // ── Helper: filled rounded rect ──────────────────────────────────────────────
  function fillRect(x: number, yPos: number, w: number, h: number, color: string, r = 4) {
    setFill(color);
    doc.roundedRect(x, yPos, w, h, r, r, 'F');
  }

  // ── Helper: horizontal divider ────────────────────────────────────────────────
  function hLine(yPos: number) {
    setDrawColor(C.divider);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, PW - margin, yPos);
  }

  // ── Helper: text with color/font ─────────────────────────────────────────────
  function txt(
    text: string,
    x: number,
    yPos: number,
    size: number,
    color: string,
    bold = false,
    align: 'left' | 'right' | 'center' = 'left',
  ) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setTextColor(color);
    doc.text(text, x, yPos, { align });
  }

  // ── Footer on current page ────────────────────────────────────────────────────
  function drawFooter() {
    txt(
      `Expense Tracker  •  Page ${pageNumber}  •  ${formatDateTime(now)}`,
      margin,
      PH - 14,
      8,
      C.gray,
    );
  }

  // ── "Continued" mini-header for overflow pages ─────────────────────────────
  function drawContinuedHeader() {
    fillRect(0, 0, PW, 28, C.primary, 0);
    txt(`Expense Tracker Report — ${profile.name}  (continued)`, margin, 18, 9, C.white);
    txt(`Page ${pageNumber}`, PW - margin, 18, 9, C.white, false, 'right');
    y = 38;
  }

  // ── Ensure enough vertical space, break page if needed ─────────────────────
  function ensureSpace(needed: number) {
    if (y + needed > PH - margin - 30) {
      drawFooter();
      doc.addPage();
      pageNumber++;
      drawContinuedHeader();
    }
  }

  // ── Section header bar (light blue) ─────────────────────────────────────────
  function sectionHeader(label: string) {
    ensureSpace(28);
    fillRect(margin, y - 2, contentW, 22, C.lightBg, 6);
    txt(label, margin + 8, y + 13, 11, C.primary, true);
    y += 26;
  }

  // ── Group header (used by split modes) ──────────────────────────────────────
  function groupHeader(label: string) {
    ensureSpace(28);
    fillRect(margin, y - 2, contentW, 20, C.groupHeader, 4);
    txt(label, margin + 8, y + 13, 10, C.primary, true);
    y += 24;
  }

  // ── Group total footer (split modes) ────────────────────────────────────────
  function groupTotal(expense: number, income: number, label: string) {
    ensureSpace(26);
    fillRect(margin, y - 2, contentW, 18, C.groupTotal, 3);
    txt(
      `${label} Expense: ${formatMoney(expense, currencyCode)}`,
      margin + 8,
      y + 12,
      10,
      C.red,
      true,
    );
    if (income > 0) {
      txt(
        `Income: ${formatMoney(income, currencyCode)}`,
        margin + contentW * 0.55,
        y + 12,
        10,
        C.green,
        true,
      );
    }
    y += 20;
    hLine(y);
    y += 10;
  }

  // ── Single transaction row ────────────────────────────────────────────────────
  function drawTxRow(tx: MoneyTransaction, index: number) {
    const hasNote = tx.note.trim() !== '';
    const rowH = hasNote ? 52 : 40;
    ensureSpace(rowH + 4);
    const startY = y;

    // Alternating row background
    if (index % 2 === 1) {
      fillRect(margin - 2, startY - 3, contentW + 4, rowH - 2, C.rowAlt, 3);
    }

    // Row number + date
    txt(
      `${index}.  ${formatDisplayDate(tx.dateMillis)}`,
      margin,
      startY + 11,
      8.5,
      C.gray,
    );

    // Amount (right-aligned)
    const sign = tx.type === 'EXPENSE' ? '−' : '+';
    const amtColor = tx.type === 'EXPENSE' ? C.red : C.green;
    const converted = convertedAmount(tx, currencyCode);
    txt(
      `${sign} ${formatMoney(converted, currencyCode)}`,
      PW - margin,
      startY + 11,
      10.5,
      amtColor,
      true,
      'right',
    );

    // Title
    const titleStr = tx.title.length > 45 ? tx.title.slice(0, 45) + '…' : tx.title;
    txt(titleStr, margin + 6, startY + 26, 10, C.bodyText);

    // Category
    txt(`• ${tx.category}`, margin + 6, startY + 38, 8.5, C.accent);

    // Note
    if (hasNote) {
      const noteStr = tx.note.length > 72 ? tx.note.slice(0, 72) + '…' : tx.note;
      txt(`  Note: ${noteStr}`, margin + 6, startY + 50, 8, C.gray);
    }

    y = startY + rowH;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Blue header banner
  // ════════════════════════════════════════════════════════════════════════════
  const bannerH = 72;
  fillRect(0, 0, PW, bannerH, C.primary, 0);

  // Title
  txt('Expense Tracker', margin, 28, 20, C.white, true);

  // Subtitle
  txt(`Financial Report  •  Profile: ${profile.name}`, margin, 46, 10.5, C.bannerSub);

  // Right side: Generated date
  txt(
    `Generated: ${formatDateTime(now)}`,
    PW - margin,
    46,
    9,
    C.bannerSub,
    false,
    'right',
  );

  // Right side: Currency + split type
  txt(
    `Currency: ${currencyCode}  |  ${PDF_SPLIT_LABELS[splitType]}`,
    PW - margin,
    60,
    9,
    C.bannerSub,
    false,
    'right',
  );

  y = bannerH + 16;

  // ════════════════════════════════════════════════════════════════════════════
  // Summary section
  // ════════════════════════════════════════════════════════════════════════════
  const allTx = profile.transactions;
  const totalExpense = allTx
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + convertedAmount(t, currencyCode), 0);
  const totalIncome = allTx
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + convertedAmount(t, currencyCode), 0);
  const balance = totalIncome - totalExpense;
  const incomeCount = allTx.filter((t) => t.type === 'INCOME').length;
  const expenseCount = allTx.filter((t) => t.type === 'EXPENSE').length;

  sectionHeader('Summary');

  // Three summary cards
  const cardW = (contentW - 16) / 3;
  const cardH = 56;

  // INCOME card
  fillRect(margin, y, cardW, cardH, C.lightGreen, 8);
  txt('INCOME', margin + 8, y + 15, 8.5, C.green, true);
  txt(formatMoney(totalIncome, currencyCode), margin + 8, y + 31, 11, C.green, true);
  txt(`${incomeCount} entries`, margin + 8, y + 47, 8, C.gray);

  // EXPENSE card
  const x2 = margin + cardW + 8;
  fillRect(x2, y, cardW, cardH, C.lightRed, 8);
  txt('EXPENSE', x2 + 8, y + 15, 8.5, C.red, true);
  txt(formatMoney(totalExpense, currencyCode), x2 + 8, y + 31, 11, C.red, true);
  txt(`${expenseCount} entries`, x2 + 8, y + 47, 8, C.gray);

  // BALANCE card
  const x3 = margin + (cardW + 8) * 2;
  const balColor = balance >= 0 ? C.primary : C.red;
  fillRect(x3, y, cardW, cardH, C.lightBlue, 8);
  txt('BALANCE', x3 + 8, y + 15, 8.5, balColor, true);
  txt(formatMoney(balance, currencyCode), x3 + 8, y + 31, 11, balColor, true);
  txt(`${allTx.length} total`, x3 + 8, y + 47, 8, C.gray);

  y += cardH + 16;

  // ════════════════════════════════════════════════════════════════════════════
  // Category Breakdown
  // ════════════════════════════════════════════════════════════════════════════
  sectionHeader('Category Breakdown  (Expenses)');

  const categoryTotals = allTx
    .filter((t) => t.type === 'EXPENSE')
    .reduce<Map<string, number>>((map, t) => {
      const val = convertedAmount(t, currencyCode);
      map.set(t.category, (map.get(t.category) ?? 0) + val);
      return map;
    }, new Map());

  const sortedCats = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1]);

  if (sortedCats.length === 0) {
    txt('No expense categories found.', margin, y, 10, C.gray);
    y += 16;
  } else {
    for (const [category, amount] of sortedCats) {
      ensureSpace(18);
      const pct =
        totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0.0';
      txt(`• ${category}`, margin, y, 10, C.bodyText);
      txt(
        `${formatMoney(amount, currencyCode)}  (${pct}%)`,
        PW - margin,
        y,
        10,
        C.red,
        true,
        'right',
      );
      y += 15;
    }
  }

  y += 6;
  hLine(y);
  y += 14;

  // ════════════════════════════════════════════════════════════════════════════
  // Transaction Details
  // ════════════════════════════════════════════════════════════════════════════
  ensureSpace(26);
  sectionHeader('Transaction Details');

  const sortedTx = [...allTx].sort((a, b) => b.dateMillis - a.dateMillis);

  if (sortedTx.length === 0) {
    txt('No transactions found.', margin, y, 10, C.gray);
    y += 16;
  } else {
    if (splitType === 'FULL') {
      sortedTx.forEach((tx, idx) => drawTxRow(tx, idx + 1));
    } else if (splitType === 'DAY') {
      // Group by date key YYYY-MM-DD
      const groups = new Map<string, MoneyTransaction[]>();
      for (const tx of sortedTx) {
        const d = new Date(tx.dateMillis);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(tx);
      }
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (const [key, txList] of [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
        const parts = key.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const label = `📅  ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}, ${dayNames[d.getDay()]}`;
        groupHeader(label);
        let exp = 0, inc = 0;
        txList.forEach((tx, idx) => {
          drawTxRow(tx, idx + 1);
          if (tx.type === 'EXPENSE') exp += convertedAmount(tx, currencyCode);
          else inc += convertedAmount(tx, currencyCode);
        });
        groupTotal(exp, inc, 'Day');
      }
    } else if (splitType === 'WEEK') {
      // Group by YYYY-Www
      function getWeekKey(millis: number): string {
        const d = new Date(millis);
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
      }
      const groups = new Map<string, MoneyTransaction[]>();
      for (const tx of sortedTx) {
        const key = getWeekKey(tx.dateMillis);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(tx);
      }
      for (const [, txList] of [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
        const from = Math.min(...txList.map((t) => t.dateMillis));
        const to = Math.max(...txList.map((t) => t.dateMillis));
        const label = `📅  Week: ${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
        groupHeader(label);
        let exp = 0, inc = 0;
        txList.forEach((tx, idx) => {
          drawTxRow(tx, idx + 1);
          if (tx.type === 'EXPENSE') exp += convertedAmount(tx, currencyCode);
          else inc += convertedAmount(tx, currencyCode);
        });
        groupTotal(exp, inc, 'Week');
      }
    } else if (splitType === 'MONTH') {
      // Group by YYYY-MM
      const groups = new Map<string, MoneyTransaction[]>();
      for (const tx of sortedTx) {
        const d = new Date(tx.dateMillis);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(tx);
      }
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      for (const [key, txList] of [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
        const parts = key.split('-').map(Number);
        const label = `📅  ${monthNames[parts[1] - 1]} ${parts[0]}`;
        groupHeader(label);
        let exp = 0, inc = 0;
        txList.forEach((tx, idx) => {
          drawTxRow(tx, idx + 1);
          if (tx.type === 'EXPENSE') exp += convertedAmount(tx, currencyCode);
          else inc += convertedAmount(tx, currencyCode);
        });
        groupTotal(exp, inc, 'Month');
      }
    }
  }

  // Final page footer
  drawFooter();

  doc.save(`expense_report_${profile.name.replace(/\s+/g, '_')}.pdf`);
}
