import { useState } from 'react';
import type { AppActions } from '../App';
import type { ExpenseAppData, ExpenseProfile, TransactionType } from '../types';
import { Field, SelectField, TextArea } from '../components/FormFields';
import CategoryDialog from '../components/CategoryDialog';
import EasyAddDialog from '../components/EasyAddDialog';
import type { ParsedTransactionDraft } from '../utils/quickAddParser';
import * as repo from '../lib/repository';
import { defaultCategoryObjects, emojiForKey } from '../utils/categoryIcons';
import { commonCurrencies } from '../utils/currency';
import { formatDate, parseDateStart } from '../utils/date';

// UUID polyfill — crypto.randomUUID is not available on older iOS Safari
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function AddTransactionPage({ appData, activeProfile, actions }: { appData: ExpenseAppData; activeProfile: ExpenseProfile; actions: AppActions }) {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(activeProfile.categories[0] || 'Other');
  const [baseCurrency, setBaseCurrency] = useState(appData.currencyCode);
  const [date, setDate] = useState(formatDate(Date.now()));
  const [note, setNote] = useState('');
  const [showCat, setShowCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEasyAdd, setShowEasyAdd] = useState(false);

  async function addCategory(name: string, iconKey: string) {
    const exists = activeProfile.categories.some((c) => c.toLowerCase() === name.toLowerCase());
    if (exists) { setCategory(name); return; }
    try {
      const saved = await repo.insertCategory(name, activeProfile.id, iconKey);
      actions.setAppData((current) => {
        if (!current) return current;
        const profiles = [...current.profiles];
        const ix = current.activeProfileIndex;
        profiles[ix] = { ...profiles[ix], categories: [...profiles[ix].categories, saved.name], categoryObjects: [...profiles[ix].categoryObjects, saved] };
        return { ...current, profiles };
      });
      setCategory(saved.name);
    } catch {
      actions.setAppData((current) => {
        if (!current) return current;
        const profiles = [...current.profiles];
        const ix = current.activeProfileIndex;
        profiles[ix] = { ...profiles[ix], categories: [...profiles[ix].categories, name], categoryObjects: [...profiles[ix].categoryObjects, { id: generateId(), name, iconKey }] };
        return { ...current, profiles };
      });
      setCategory(name);
    }
  }

  async function submit() {
    const value = Number(amount);
    const parsed = parseDateStart(date);
    if (!Number.isFinite(value) || value <= 0 || !parsed) return alert('Enter a valid amount and date.');
    setSaving(true);
    try {
      await actions.addTransaction({
        id: generateId(),
        type,
        title: title.trim() || (type === 'EXPENSE' ? 'Expense' : 'Income'),
        category: type === 'INCOME' ? 'Income' : category,
        amount: value,
        baseCurrency,
        displayCurrency: appData.currencyCode,
        dateMillis: parsed,
        note
      });
    } finally { setSaving(false); }
  }

  /** Called when user taps "Edit Details" in Easy Add dialog */
  function handleEditDetails(draft: ParsedTransactionDraft) {
    setType(draft.type);
    setTitle(draft.title);
    setAmount(String(draft.amount));
    setCategory(draft.category);
    setBaseCurrency(draft.currency);
    setDate(draft.date);
    setNote(draft.note);
  }

  const cats = activeProfile.categoryObjects.length ? activeProfile.categoryObjects : defaultCategoryObjects;

  return <div className="screen"><div className="card space-y-4">
    {/* ── Page title row with Easy Add button ── */}
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-xl font-extrabold">Add Entry</h1>
      <button
        className="easy-add-trigger-btn"
        onClick={() => setShowEasyAdd(true)}
        aria-label="Open Easy Add"
      >
        ⚡ Easy Add
      </button>
    </div>

    <div className="grid grid-cols-2 gap-2"><button className={`chip ${type === 'EXPENSE' ? 'chip-active' : ''}`} onClick={() => setType('EXPENSE')}>Expense</button><button className={`chip ${type === 'INCOME' ? 'chip-active' : ''}`} onClick={() => setType('INCOME')}>Income Optional</button></div>
    <Field label={type === 'EXPENSE' ? 'Expense title' : 'Income title'} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: Lunch, Salary, Petrol" />
    <Field label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
    <SelectField label="Currency" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>{commonCurrencies.map((c) => <option key={c}>{c}</option>)}</SelectField>
    {type === 'EXPENSE' && <div className="space-y-2"><SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>{cats.map((c) => <option key={c.name} value={c.name}>{emojiForKey(c.iconKey)} {c.name}</option>)}</SelectField><button className="outline-btn w-full text-[#2563EB]" onClick={() => setShowCat(true)}>+ Add Category</button></div>}
    <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
    <TextArea label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
    <button className="primary-btn w-full" disabled={saving} onClick={submit}>{saving ? 'Saving...' : 'Save Entry'}</button>
    {showCat && <CategoryDialog onClose={() => setShowCat(false)} onAdd={addCategory} />}

    {/* ── Easy Add Dialog ── */}
    {showEasyAdd && (
      <EasyAddDialog
        open={showEasyAdd}
        onClose={() => setShowEasyAdd(false)}
        appData={appData}
        activeProfile={activeProfile}
        actions={actions}
        onEditDetails={handleEditDetails}
      />
    )}
  </div></div>;
}
