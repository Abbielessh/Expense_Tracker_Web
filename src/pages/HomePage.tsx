import { Link } from 'react-router-dom';
import type { AppActions } from '../App';
import type { ExpenseAppData, ExpenseProfile, RecurringTransaction, TransactionType } from '../types';
import SummaryMiniCard from '../components/SummaryMiniCard';
import TransactionCard from '../components/TransactionCard';
import { formatMoney } from '../utils/money';
import { imageForCategory } from '../utils/categoryIconMap';
import logoIcon from '../assets/app_logo_expense.png';

const RECENT_LIMIT = 5;

export default function HomePage({ appData, activeProfile, recurring, actions }: { appData: ExpenseAppData; activeProfile: ExpenseProfile; recurring: RecurringTransaction[]; actions: AppActions }) {
  const recent = [...activeProfile.transactions].sort((a, b) => b.dateMillis - a.dateMillis).slice(0, RECENT_LIMIT);
  const totalCount = activeProfile.transactions.length;
  const upcoming = recurring.filter((r) => r.isActive && r.nextDueDate).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)).slice(0, 3);
  const income = activeProfile.transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const expense = activeProfile.transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  return <div className="screen space-y-4">
    <header className="flex items-center justify-between gap-4">
      <div><p className="text-sm text-[#667085]">Welcome back</p><h1 className="text-[26px] font-extrabold text-[#101828]">{activeProfile.name}</h1></div>
      <div className="flex h-[68px] w-[68px] items-center justify-center rounded-[18px] bg-white shadow-soft overflow-hidden">
        <img src={logoIcon} alt="Expense Tracker" className="h-[60px] w-[60px] object-contain" />
      </div>
    </header>

    <div className="card bg-gradient-to-br from-[#2563EB] to-[#00A3FF] text-white">
      <p className="text-sm text-white/80">Current Balance</p>
      <p className="mt-1 text-3xl font-extrabold">{formatMoney(balance, appData.currencyCode)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/80">Income</p><p className="font-extrabold">{formatMoney(income, appData.currencyCode)}</p></div>
        <div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/80">Expense</p><p className="font-extrabold">{formatMoney(expense, appData.currencyCode)}</p></div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <SummaryMiniCard title="Transactions" value={String(totalCount)} tone="blue" />
      <SummaryMiniCard title="Currency" value={appData.currencyCode} tone="purple" />
    </div>

    {upcoming.length > 0 && <div className="card bg-[#FFFBEB]">
      <h2 className="mb-3 text-base font-extrabold text-[#92400E]">🔄 Upcoming Recurring</h2>
      <div className="space-y-3">{upcoming.map((rec) => <div key={rec.id} className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F2F4F7] p-1.5"><img src={imageForCategory(rec.category)} alt={rec.category} className="cat-icon-card" /></div><div><p className="font-bold">{rec.title}</p><p className="text-xs text-[#667085]">{rec.frequency} • {rec.nextDueDate}</p></div></div><p className={`font-extrabold ${rec.type === 'EXPENSE' ? 'text-[#DC2626]' : 'text-[#059669]'}`}>{rec.type === 'EXPENSE' ? '-' : '+'} {formatMoney(rec.amount, appData.currencyCode)}</p></div>)}</div>
    </div>}

    <section>
      <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-extrabold">Recent Transactions</h2>{totalCount > RECENT_LIMIT && <p className="text-xs text-[#667085]">Showing latest {RECENT_LIMIT} of {totalCount}</p>}</div>{totalCount > RECENT_LIMIT && <Link className="text-sm font-extrabold text-[#2563EB]" to="/transactions">View All</Link>}</div>
      <div className="space-y-3">{recent.length ? recent.map((tx) => <TransactionCard key={tx.id} transaction={tx} profile={activeProfile} currencyCode={appData.currencyCode} onUpdate={actions.updateTransaction} onDelete={actions.deleteTransaction} />) : <div className="card text-center"><p className="text-lg font-extrabold">No transactions yet</p><p className="text-sm text-[#667085]">Add your first expense or income entry.</p><Link to="/add" className="primary-btn mt-4 w-full">Add Entry</Link></div>}</div>
    </section>
  </div>;
}
