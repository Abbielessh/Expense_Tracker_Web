import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { ExpenseProfile } from '../types';
import { imageForCategory } from '../utils/categoryIconMap';
import {
  endOfDayMillis,
  formatDate,
  monthStartMillis,
  parseDateEnd,
  parseDateStart,
  todayStartMillis,
  weekStartMillis,
} from '../utils/date';
import { convertedAmount, formatMoney } from '../utils/money';

type Period = 'today' | 'week' | 'month' | 'custom';

const PIE_COLORS = [
  '#2563EB', '#10B981', '#DC2626', '#D97706',
  '#7C3AED', '#0891B2', '#DB2777', '#65A30D',
  '#F59E0B', '#6366F1',
];

function getPeriodRange(period: Period, customStart: string, customEnd: string): [number, number] | null {
  const now = Date.now();
  if (period === 'today') return [todayStartMillis(), endOfDayMillis(now)];
  if (period === 'week') return [weekStartMillis(), endOfDayMillis(now)];
  if (period === 'month') return [monthStartMillis(), endOfDayMillis(now)];
  if (period === 'custom') {
    const s = parseDateStart(customStart);
    const e = parseDateEnd(customEnd);
    if (s !== null && e !== null) return [s, e];
    return null;
  }
  return null;
}

export default function ReportsPage({ profile, currencyCode }: { profile: ExpenseProfile; currencyCode: string }) {
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState(formatDate(monthStartMillis()));
  const [customEnd, setCustomEnd] = useState(formatDate(Date.now()));

  const range = getPeriodRange(period, customStart, customEnd);

  // Filter expense transactions in selected period, grouped by category
  const categoryData = useMemo(() => {
    if (!range) return [];
    const [startMs, endMs] = range;
    const expenses = profile.transactions.filter(
      (t) => t.type === 'EXPENSE' && t.dateMillis >= startMs && t.dateMillis <= endMs,
    );
    const map = new Map<string, number>();
    for (const t of expenses) {
      const converted = convertedAmount(t, currencyCode);
      map.set(t.category, (map.get(t.category) ?? 0) + converted);
    }
    return Array.from(map, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [profile.transactions, currencyCode, range]);

  const totalExpense = categoryData.reduce((s, c) => s + c.value, 0);
  const hasData = categoryData.length > 0;

  const PERIOD_BTNS: { id: Period; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="screen">
      {/* ── Main report card ─────────────────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          borderRadius: '24px',
          boxShadow: '0 4px 32px rgba(37,99,235,0.10), 0 1px 4px rgba(0,0,0,0.06)',
          padding: '20px',
          maxWidth: '480px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Card header */}
        <div style={{ marginBottom: '16px' }}>
          <h1
            style={{
              fontSize: '19px',
              fontWeight: 800,
              color: '#101828',
              margin: 0,
              letterSpacing: '-0.3px',
            }}
          >
            Expense Graph Report
          </h1>
          <p style={{ fontSize: '12px', color: '#667085', marginTop: '2px' }}>
            {profile.name}
          </p>
        </div>

        {/* ── Period filter buttons ──────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}
        >
          {PERIOD_BTNS.map((btn) => {
            const active = period === btn.id;
            return (
              <button
                key={btn.id}
                id={`period-btn-${btn.id}`}
                onClick={() => setPeriod(btn.id)}
                style={{
                  flex: '1 1 0',
                  minWidth: '62px',
                  padding: '8px 6px',
                  borderRadius: '12px',
                  border: active ? '1.5px solid #2563EB' : '1.5px solid #E5E7EB',
                  background: active ? '#EEF4FF' : '#F9FAFB',
                  color: active ? '#2563EB' : '#344054',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        {/* ── Custom date pickers ──────────────────────────────────────── */}
        {period === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '4px' }}>
                Start Date
              </label>
              <input
                id="custom-start-date"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1.5px solid #E5E7EB',
                  fontSize: '13px',
                  color: '#101828',
                  background: '#F9FAFB',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', display: 'block', marginBottom: '4px' }}>
                End Date
              </label>
              <input
                id="custom-end-date"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1.5px solid #E5E7EB',
                  fontSize: '13px',
                  color: '#101828',
                  background: '#F9FAFB',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* ── Donut chart + empty state ─────────────────────────────────── */}
        {!hasData ? (
          <div
            style={{
              height: '220px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '40px' }}>📊</span>
            <p style={{ fontSize: '14px', color: '#667085', fontWeight: 600, textAlign: 'center' }}>
              No expenses found for this period.
            </p>
          </div>
        ) : (
          <>
            {/* Donut chart */}
            <div style={{ position: 'relative', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={95}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <p style={{ fontSize: '11px', color: '#667085', fontWeight: 600, margin: 0 }}>Total</p>
                <p
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#101828',
                    margin: '2px 0 0',
                    letterSpacing: '-0.5px',
                    maxWidth: '100px',
                    lineHeight: 1.2,
                  }}
                >
                  {formatMoney(totalExpense, currencyCode)}
                </p>
              </div>
            </div>

            {/* ── Category legend rows ──────────────────────────────────── */}
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categoryData.map((cat, i) => {
                const color = PIE_COLORS[i % PIE_COLORS.length];
                const pct = totalExpense > 0 ? ((cat.value / totalExpense) * 100).toFixed(1) : '0.0';
                const imgSrc = imageForCategory(cat.name);
                return (
                  <div
                    key={cat.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {/* Color dot */}
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    {/* Category image icon */}
                    <span
                      style={{
                        width: '22px',
                        height: '22px',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={imgSrc}
                        alt={cat.name}
                        style={{ width: '20px', height: '20px', objectFit: 'contain', display: 'block' }}
                      />
                    </span>
                    {/* Category name */}
                    <span
                      style={{
                        flex: 1,
                        fontSize: '13px',
                        color: '#344054',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.name}
                    </span>
                    {/* Amount + pct */}
                    <span
                      style={{
                        fontSize: '13px',
                        color: '#101828',
                        fontWeight: 700,
                        flexShrink: 0,
                        textAlign: 'right',
                      }}
                    >
                      {formatMoney(cat.value, currencyCode)}{' '}
                      <span style={{ color: '#667085', fontWeight: 500 }}>({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
