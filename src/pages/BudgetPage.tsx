import { useState } from 'react';
import type { AppActions } from '../App';
import type { Budget, ExpenseAppData, ExpenseProfile } from '../types';
import Modal from '../components/Modal';
import { Field, SelectField } from '../components/FormFields';
import { formatMoney } from '../utils/money';
import * as repo from '../lib/repository';

export default function BudgetPage({ appData, activeProfile, budgets, actions }: { appData: ExpenseAppData; activeProfile: ExpenseProfile; budgets: Budget[]; actions: AppActions }) {
  const [editing, setEditing] = useState<Budget | null>(null);
  return <div className="screen space-y-4"><header className="flex items-center justify-between"><h1 className="text-[26px] font-extrabold">Budget Limits</h1><button className="primary-btn" onClick={() => setEditing({ id: '', userId: '', profileId: activeProfile.id, category: 'ALL', period: 'monthly', limitAmount: 0, currency: appData.currencyCode })}>+ Add</button></header>{budgets.length ? <div className="space-y-3">{budgets.map((b) => <BudgetCard key={b.id} budget={b} profile={activeProfile} currencyCode={appData.currencyCode} onEdit={() => setEditing(b)} onDelete={async () => { if (!confirm('Delete budget?')) return; await repo.deleteBudget(b.id); actions.setBudgets((list) => list.filter((x) => x.id !== b.id)); }} />)}</div> : <div className="card text-center"><p className="font-extrabold text-[#667085]">No budgets set</p><p className="text-sm text-[#9E9E9E]">Tap + Add to set a spending limit.</p></div>}{editing && <BudgetModal budget={editing} profile={activeProfile} currencyCode={appData.currencyCode} onClose={() => setEditing(null)} onSave={async (b) => { const saved = await repo.upsertBudget(b); actions.setBudgets((list) => [...list.filter((x) => x.id !== saved.id), saved]); setEditing(null); }} />}</div>;
}

function BudgetCard({ budget, profile, currencyCode, onEdit, onDelete }: { budget: Budget; profile: ExpenseProfile; currencyCode: string; onEdit: () => void; onDelete: () => Promise<void> }) {
  const now = new Date();
  const spent = profile.transactions.filter((t) => {
    const d = new Date(t.dateMillis);
    return t.type === 'EXPENSE' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && (budget.category === 'ALL' || t.category === budget.category);
  }).reduce((s, t) => s + t.amount, 0);
  const pct = budget.limitAmount > 0 ? Math.min(100, Math.round((spent / budget.limitAmount) * 100)) : 0;
  const over = spent > budget.limitAmount;
  return <div className={`card ${over ? 'bg-red-50' : pct >= 80 ? 'bg-yellow-50' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-extrabold">{budget.category === 'ALL' ? 'Overall Budget' : budget.category}</p><p className="text-sm text-[#667085]">Spent {formatMoney(spent, currencyCode)} of {formatMoney(budget.limitAmount, currencyCode)}</p></div><p className={`font-extrabold ${over ? 'text-[#DC2626]' : 'text-[#2563EB]'}`}>{pct}%</p></div><div className="mt-3 h-3 rounded-full bg-slate-200"><div className={`h-3 rounded-full ${over ? 'bg-[#DC2626]' : 'bg-[#2563EB]'}`} style={{ width: `${pct}%` }} /></div><div className="mt-3 flex justify-end gap-2"><button className="outline-btn text-blue-600" onClick={onEdit}>Edit</button><button className="outline-btn text-red-600" onClick={onDelete}>Delete</button></div></div>;
}

function BudgetModal({ budget, profile, currencyCode, onClose, onSave }: { budget: Budget; profile: ExpenseProfile; currencyCode: string; onClose: () => void; onSave: (b: Budget) => Promise<void> }) {
  const [category, setCategory] = useState(budget.category);
  const [amount, setAmount] = useState(String(budget.limitAmount || ''));
  return <Modal title={budget.id ? 'Edit Budget' : 'Add Budget'} onClose={onClose}><div className="space-y-4"><SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="ALL">Overall Monthly Budget</option>{profile.categories.map((c) => <option key={c}>{c}</option>)}</SelectField><Field label={`Limit amount (${currencyCode})`} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /><button className="primary-btn w-full" onClick={() => { const value = Number(amount); if (value > 0) onSave({ ...budget, category, limitAmount: value, currency: currencyCode }); }}>Save</button></div></Modal>;
}
