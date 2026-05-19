import { useMemo, useState } from 'react';
import Modal from './Modal';
import { Field } from './FormFields';
import { guessIconKeyFromName, iconChoices } from '../utils/categoryIcons';

export default function CategoryDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, iconKey: string) => Promise<void> | void }) {
  const [name, setName] = useState('');
  const [iconKey, setIconKey] = useState('other');
  const suggested = useMemo(() => guessIconKeyFromName(name), [name]);

  function updateName(v: string) {
    setName(v);
    const guess = guessIconKeyFromName(v);
    if (guess !== 'other') setIconKey(guess);
  }

  return (
    <Modal title="Add Category" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Category name" value={name} onChange={(e) => updateName(e.target.value)} placeholder="Example: Haircut" />
        <div>
          <p className="label">Choose icon</p>
          <div className="grid grid-cols-4 gap-2">
            {iconChoices.map((i) => (
              <button key={i.key} type="button" onClick={() => setIconKey(i.key)} className={`rounded-2xl border p-3 text-2xl ${iconKey === i.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <span>{i.emoji}</span>
                <span className="mt-1 block text-[10px] font-bold text-slate-500">{i.key}</span>
              </button>
            ))}
          </div>
          {suggested !== 'other' && <p className="mt-2 text-xs text-slate-500">Suggested: {suggested}</p>}
        </div>
        <button className="primary-btn w-full" onClick={async () => { if (!name.trim()) return; await onAdd(name.trim(), iconKey); onClose(); }}>Add Category</button>
      </div>
    </Modal>
  );
}
