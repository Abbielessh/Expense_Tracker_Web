import { useMemo, useState } from 'react';
import type { AppActions } from '../App';
import type { ExpenseAppData, ExpenseProfile, TransactionType } from '../types';
import TransactionCard from '../components/TransactionCard';
import { Field, SelectField } from '../components/FormFields';
import { sameDay, sameMonth, sameWeek } from '../utils/date';

const PAGE_SIZE = 10;
type Filter = 'ALL' | TransactionType | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';

export default function AllTransactionsPage({ appData, activeProfile, actions }: { appData: ExpenseAppData; activeProfile: ExpenseProfile; actions: AppActions }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [category, setCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return [...activeProfile.transactions].sort((a, b) => b.dateMillis - a.dateMillis).filter((tx) => {
      if (filter === 'EXPENSE' && tx.type !== 'EXPENSE') return false;
      if (filter === 'INCOME' && tx.type !== 'INCOME') return false;
      if (filter === 'TODAY' && !sameDay(tx.dateMillis, Date.now())) return false;
      if (filter === 'THIS_WEEK' && !sameWeek(tx.dateMillis)) return false;
      if (filter === 'THIS_MONTH' && !sameMonth(tx.dateMillis)) return false;
      if (category !== 'ALL' && tx.category !== category) return false;
      if (!q) return true;
      return tx.title.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q) || tx.note.toLowerCase().includes(q) || String(tx.amount).includes(q);
    });
  }, [activeProfile.transactions, filter, category, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const items = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return <div className="screen space-y-4">
    <header><h1 className="text-[26px] font-extrabold">All Transactions</h1><p className="text-sm text-[#667085]">{activeProfile.name}</p></header>
    <div className="card space-y-3"><Field label="Search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Title, category, note, amount" />
      <div className="grid grid-cols-2 gap-3"><SelectField label="Filter" value={filter} onChange={(e) => { setFilter(e.target.value as Filter); setPage(1); }}><option value="ALL">All</option><option value="EXPENSE">Expense</option><option value="INCOME">Income</option><option value="TODAY">Today</option><option value="THIS_WEEK">This Week</option><option value="THIS_MONTH">This Month</option></SelectField><SelectField label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="ALL">All</option>{activeProfile.categories.map((c) => <option key={c}>{c}</option>)}</SelectField></div>
    </div>
    <div className="space-y-3">{items.length ? items.map((tx) => <TransactionCard key={tx.id} transaction={tx} profile={activeProfile} currencyCode={appData.currencyCode} onUpdate={actions.updateTransaction} onDelete={actions.deleteTransaction} />) : <div className="card text-center text-[#667085]">No transactions found.</div>}</div>
    <div className="card-tight flex items-center justify-between"><button className="outline-btn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button><p className="font-bold text-[#667085]">Page {safePage} / {pages}</p><button className="outline-btn" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>Next</button></div>
  </div>;
}
