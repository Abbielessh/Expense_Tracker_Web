import { useMemo, useState } from 'react';
import Modal from './Modal';
import { Field } from './FormFields';
import { guessIconKeyFromName } from '../utils/categoryIcons';
import { categoryImageMap, imageForKey } from '../utils/categoryIconMap';

// Build icon choices from the image map (same keys as old emoji choices)
const imageIconChoices = Object.keys(categoryImageMap).map((key) => ({ key, src: categoryImageMap[key] }));

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
            {imageIconChoices.map((i) => (
              <button
                key={i.key}
                type="button"
                onClick={() => setIconKey(i.key)}
                className={`rounded-2xl border p-3 flex flex-col items-center gap-1 ${iconKey === i.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
              >
                <img src={i.src} alt={i.key} className="w-8 h-8 object-contain" />
                <span className="mt-0.5 block text-[10px] font-bold text-slate-500 capitalize">{i.key}</span>
              </button>
            ))}
          </div>
          {suggested !== 'other' && (
            <p className="mt-2 text-xs text-slate-500">
              Suggested: {suggested}&nbsp;
              <img src={imageForKey(suggested)} alt={suggested} className="inline-block cat-icon-dropdown align-middle" />
            </p>
          )}
        </div>
        <button className="primary-btn w-full" onClick={async () => { if (!name.trim()) return; await onAdd(name.trim(), iconKey); onClose(); }}>Add Category</button>
      </div>
    </Modal>
  );
}
