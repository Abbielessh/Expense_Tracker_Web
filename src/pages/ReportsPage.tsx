import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExpenseProfile } from '../types';
import SummaryMiniCard from '../components/SummaryMiniCard';
import { Field, SelectField } from '../components/FormFields';
import { endOfDayMillis, formatDate, monthStartMillis, parseDateEnd, parseDateStart, todayStartMillis, weekStartMillis } from '../utils/date';
import { formatMoney, sumBetween } from '../utils/money';

export default function ReportsPage({ profile, currencyCode }: { profile: ExpenseProfile; currencyCode: string }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [startDate, setStartDate] = useState(formatDate(monthStartMillis()));
  const [endDate, setEndDate] = useState(formatDate(Date.now()));
  const expenseTransactions = profile.transactions.filter((t) => t.type === 'EXPENSE' && (selectedCategory === 'All' || t.category === selectedCategory));
  const today = sumBetween(expenseTransactions, todayStartMillis(), endOfDayMillis(Date.now()), currencyCode);
  const week = sumBetween(expenseTransactions, weekStartMillis(), endOfDayMillis(Date.now()), currencyCode);
  const month = sumBetween(expenseTransactions, monthStartMillis(), endOfDayMillis(Date.now()), currencyCode);
  const customStart = parseDateStart(startDate), customEnd = parseDateEnd(endDate);
  const custom = customStart && customEnd ? sumBetween(expenseTransactions, customStart, customEnd, currencyCode) : 0;
  const chartData = [{ name: 'Today', amount: today }, { name: 'Week', amount: week }, { name: 'Month', amount: month }, { name: 'Custom', amount: custom }];
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    profile.transactions.filter((t) => t.type === 'EXPENSE').forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [profile.transactions]);

  const PIE_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'];

  return <div className="screen space-y-4">
    <div className="card space-y-4"><h1 className="text-xl font-extrabold">Category Expense Report</h1><SelectField label="Report Category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}><option>All</option>{profile.categories.map((c) => <option key={c}>{c}</option>)}</SelectField><div className="grid grid-cols-2 gap-3"><SummaryMiniCard title="Today" value={formatMoney(today, currencyCode)} tone="red" /><SummaryMiniCard title="This Week" value={formatMoney(week, currencyCode)} tone="orange" /></div><SummaryMiniCard title="This Month" value={formatMoney(month, currencyCode)} tone="purple" /><div className="grid grid-cols-2 gap-3"><Field label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><Field label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div><SummaryMiniCard title="Custom Range" value={formatMoney(custom, currencyCode)} tone="blue" /></div>
    <div className="card"><h2 className="mb-3 text-lg font-extrabold">Spending Overview</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v) => formatMoney(Number(v), currencyCode)} /><Bar dataKey="amount" fill="#2563EB" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
    <div className="card"><h2 className="mb-3 text-lg font-extrabold">Category Breakdown</h2>{categoryData.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={92} label>{categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => formatMoney(Number(v), currencyCode)} /></PieChart></ResponsiveContainer></div> : <p className="text-sm text-[#667085]">No expense data yet.</p>}</div>
  </div>;
}
