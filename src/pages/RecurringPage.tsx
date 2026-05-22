import { useState } from 'react';
import type { AppActions } from '../App';
import type { ExpenseProfile, Frequency, RecurringTransaction, TransactionType } from '../types';
import Modal from '../components/Modal';
import { Field, SelectField, TextArea } from '../components/FormFields';
import { formatDate } from '../utils/date';
import { formatMoney } from '../utils/money';
import { imageForCategory } from '../utils/categoryIconMap';
import * as repo from '../lib/repository';

export default function RecurringPage({ profile, currencyCode, recurring, actions }: { profile: ExpenseProfile; currencyCode: string; recurring: RecurringTransaction[]; actions: AppActions }) {
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const active = recurring.filter((r) => r.isActive);
  const inactive = recurring.filter((r) => !r.isActive);
  const makeNew = (): RecurringTransaction => ({ id: '', userId: '', profileId: profile.id, type: 'EXPENSE', title: '', category: profile.categories[0] || 'Other', amount: 0, baseCurrency: currencyCode, note: '', frequency: 'MONTHLY', startDate: formatDate(Date.now()), nextDueDate: formatDate(Date.now()), isActive: true });

  async function save(rec: RecurringTransaction) {
    if (rec.id) { await repo.updateRecurringTransaction(rec); actions.setRecurring((list) => list.map((x) => x.id === rec.id ? rec : x)); }
    else { const saved = await repo.addRecurringTransaction(rec); actions.setRecurring((list) => [...list, saved]); }
    setEditing(null);
  }

  async function remove(id: string) { if (!confirm('Delete recurring transaction?')) return; await repo.deleteRecurringTransaction(id); actions.setRecurring((list) => list.filter((x) => x.id !== id)); }
  async function toggle(id: string, isActive: boolean) { await repo.toggleRecurringActive(id, isActive); actions.setRecurring((list) => list.map((x) => x.id === id ? { ...x, isActive } : x)); }

  return <div className="screen space-y-4"><header className="flex items-center justify-between"><h1 className="text-[28px] font-extrabold">Recurring</h1><button className="primary-btn" onClick={() => setEditing(makeNew())}>+ Add</button></header>{active.length > 0 && <Section title="Active" items={active} currencyCode={currencyCode} onEdit={setEditing} onDelete={remove} onToggle={toggle} />}{inactive.length > 0 && <Section title="Inactive" items={inactive} currencyCode={currencyCode} onEdit={setEditing} onDelete={remove} onToggle={toggle} />}{!recurring.length && <div className="card text-center"><p className="text-lg font-extrabold">🔄 No recurring transactions</p><p className="text-sm text-[#667085]">Add recurring expenses like Rent, Netflix, EMI.</p></div>}{editing && <RecurringModal item={editing} profile={profile} currencyCode={currencyCode} onClose={() => setEditing(null)} onSave={save} />}</div>;
}

function Section({ title, items, currencyCode, onEdit, onDelete, onToggle }: { title: string; items: RecurringTransaction[]; currencyCode: string; onEdit: (r: RecurringTransaction) => void; onDelete: (id: string) => void; onToggle: (id: string, active: boolean) => void }) {
  return <section><h2 className={`mb-2 font-extrabold ${title === 'Active' ? 'text-[#059669]' : 'text-[#667085]'}`}>{title}</h2><div className="space-y-3">{items.map((rec) => <div key={rec.id} className={`card-tight ${rec.isActive ? '' : 'bg-slate-100'}`}><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F2F4F7] p-2"><img src={imageForCategory(rec.category)} alt={rec.category} className="cat-icon-card" /></div><div className="min-w-0 flex-1"><p className="truncate font-extrabold">{rec.title}</p><p className="text-xs text-[#667085]">{rec.category} • {rec.frequency}</p><p className="text-xs font-bold text-[#2563EB]">Next: {rec.nextDueDate}</p></div><p className={`font-extrabold ${rec.type === 'EXPENSE' ? 'text-[#DC2626]' : 'text-[#059669]'}`}>{rec.type === 'EXPENSE' ? '-' : '+'} {formatMoney(rec.amount, currencyCode)}</p></div><div className="mt-3 flex justify-end gap-2"><button className="outline-btn" onClick={() => onToggle(rec.id, !rec.isActive)}>{rec.isActive ? 'Active' : 'Inactive'}</button><button className="outline-btn text-blue-600" onClick={() => onEdit(rec)}>Edit</button><button className="outline-btn text-red-600" onClick={() => onDelete(rec.id)}>Delete</button></div></div>)}</div></section>;
}

function RecurringModal({ item, profile, currencyCode, onClose, onSave }: { item: RecurringTransaction; profile: ExpenseProfile; currencyCode: string; onClose: () => void; onSave: (r: RecurringTransaction) => Promise<void> }) {
  const [type, setType] = useState<TransactionType>(item.type);
  const [title, setTitle] = useState(item.title);
  const [amount, setAmount] = useState(String(item.amount || ''));
  const [category, setCategory] = useState(item.category);
  const [frequency, setFrequency] = useState<Frequency>(item.frequency);
  const [startDate, setStartDate] = useState(item.startDate || formatDate(Date.now()));
  const [nextDueDate, setNextDueDate] = useState(item.nextDueDate || formatDate(Date.now()));
  const [note, setNote] = useState(item.note);
  return <Modal title={item.id ? 'Edit Recurring' : 'Add Recurring'} onClose={onClose}><div className="space-y-4"><div className="grid grid-cols-2 gap-2"><button className={`chip ${type === 'EXPENSE' ? 'chip-active' : ''}`} onClick={() => setType('EXPENSE')}>Expense</button><button className={`chip ${type === 'INCOME' ? 'chip-active' : ''}`} onClick={() => setType('INCOME')}>Income</button></div><Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} /><Field label={`Amount (${currencyCode})`} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /><SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>{profile.categories.map((c) => <option key={c}>{c}</option>)}</SelectField><SelectField label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></SelectField><div className="grid grid-cols-2 gap-3"><Field label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><Field label="Next Due" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} /></div><TextArea label="Note" value={note} onChange={(e) => setNote(e.target.value)} /><button className="primary-btn w-full" onClick={() => { const value = Number(amount); if (!title.trim() || value <= 0) return alert('Enter title and valid amount'); onSave({ ...item, type, title, amount: value, category, frequency, startDate, nextDueDate, note, isActive: true }); }}>Save</button></div></Modal>;
}
