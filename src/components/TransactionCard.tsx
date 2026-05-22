import { useState } from 'react';
import type { ExpenseProfile, MoneyTransaction, TransactionType } from '../types';
import { imageForCategory } from '../utils/categoryIconMap';
import { formatDate, parseDateStart } from '../utils/date';
import { formatMoney } from '../utils/money';
import Modal from './Modal';
import { Field, SelectField, TextArea } from './FormFields';

export default function TransactionCard({
  transaction, currencyCode, profile, onUpdate, onDelete
}: {
  transaction: MoneyTransaction;
  currencyCode: string;
  profile: ExpenseProfile;
  onUpdate: (tx: MoneyTransaction) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isExpense = transaction.type === 'EXPENSE';
  const categoryIconSrc = imageForCategory(transaction.category, profile.categoryObjects.find((c) => c.name === transaction.category)?.iconKey);

  return (
    <div className="card-tight">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F2F4F7] p-2">
            <img src={categoryIconSrc} alt={transaction.category} className="cat-icon-card" />
          </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-extrabold text-[#101828]">{transaction.title}</p>
          <p className="mt-0.5 text-[13px] text-[#667085]">{transaction.category} • {formatDate(transaction.dateMillis)}</p>
          {transaction.note && <p className="mt-0.5 truncate text-xs text-[#98A2B3]">{transaction.note}</p>}
        </div>
        <p className={`shrink-0 text-right text-[15px] font-extrabold ${isExpense ? 'text-[#DC2626]' : 'text-[#059669]'}`}>
          {isExpense ? '- ' : '+ '}{formatMoney(transaction.amount, currencyCode)}
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button className="outline-btn text-blue-600" onClick={() => setEditing(true)}>Edit</button>
        <button className="outline-btn text-red-600" disabled={deleting} onClick={async () => { if (!confirm('Delete this transaction?')) return; setDeleting(true); await onDelete(transaction.id); setDeleting(false); }}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
      {editing && <EditTransactionModal transaction={transaction} profile={profile} currencyCode={currencyCode} onClose={() => setEditing(false)} onSave={async (tx) => { await onUpdate(tx); setEditing(false); }} />}
    </div>
  );
}

function EditTransactionModal({ transaction, profile, currencyCode, onClose, onSave }: {
  transaction: MoneyTransaction; profile: ExpenseProfile; currencyCode: string; onClose: () => void; onSave: (tx: MoneyTransaction) => void | Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [title, setTitle] = useState(transaction.title);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState(transaction.category);
  const [date, setDate] = useState(formatDate(transaction.dateMillis));
  const [note, setNote] = useState(transaction.note);

  return (
    <Modal title="Edit Transaction" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button className={`chip ${type === 'EXPENSE' ? 'chip-active' : ''}`} onClick={() => setType('EXPENSE')}>Expense</button>
          <button className={`chip ${type === 'INCOME' ? 'chip-active' : ''}`} onClick={() => setType('INCOME')}>Income</button>
        </div>
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field label={`Amount (${currencyCode})`} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {type === 'EXPENSE' && (
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {profile.categoryObjects.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </SelectField>
        )}
        <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextArea label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="primary-btn w-full" onClick={() => {
          const parsed = parseDateStart(date);
          const value = Number(amount);
          if (!parsed || !Number.isFinite(value) || value <= 0) return alert('Enter valid amount and date');
          onSave({ ...transaction, type, title: title || (type === 'EXPENSE' ? 'Expense' : 'Income'), amount: value, category: type === 'INCOME' ? 'Income' : (category || 'Other'), dateMillis: parsed, note });
        }}>Save</button>
      </div>
    </Modal>
  );
}
