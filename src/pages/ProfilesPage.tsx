import { useState } from 'react';
import type { AppActions } from '../App';
import type { ExpenseAppData } from '../types';
import Modal from '../components/Modal';
import { Field } from '../components/FormFields';

export default function ProfilesPage({ appData, actions }: { appData: ExpenseAppData; actions: AppActions }) {
  const [adding, setAdding] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  return <div className="screen space-y-4"><header><h1 className="text-[28px] font-extrabold">Profiles</h1><p className="text-sm text-[#667085]">Switch or add new profiles to track separate data</p></header><div className="space-y-3">{appData.profiles.map((p, i) => {
    const active = i === appData.activeProfileIndex;
    return <button key={p.id} onClick={() => actions.setActiveProfile(i)} className={`w-full rounded-[20px] p-4 text-left shadow-soft ring-1 ring-black/5 ${active ? 'bg-[#2563EB] text-white' : 'bg-white text-[#101828]'}`}><div className="flex items-center justify-between gap-3"><div><p className="text-lg font-extrabold">{p.name}</p><p className={`${active ? 'text-white/80' : 'text-[#667085]'} text-sm`}>{p.transactions.length} transactions</p></div>{active && <p className="font-bold">Active</p>}</div><div className="mt-4 flex gap-2"><span className="outline-btn bg-white/90" onClick={(e) => { e.stopPropagation(); setEditIndex(i); }}>Edit</span><span className="outline-btn bg-white/90 text-red-600" onClick={async (e) => { e.stopPropagation(); if (confirm('Delete profile?')) await actions.deleteProfile(i); }}>Delete</span></div></button>;
  })}</div><button className="primary-btn w-full" onClick={() => setAdding(true)}>+ Add Profile</button>{adding && <ProfileModal title="Add Profile" onClose={() => setAdding(false)} onSave={async (name) => { await actions.addProfile(name); setAdding(false); }} />}{editIndex !== null && <ProfileModal title="Edit Profile" initial={appData.profiles[editIndex].name} onClose={() => setEditIndex(null)} onSave={async (name) => { await actions.updateProfile(editIndex, name); setEditIndex(null); }} />}</div>;
}

function ProfileModal({ title, initial = '', onClose, onSave }: { title: string; initial?: string; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  return <Modal title={title} onClose={onClose}><div className="space-y-4"><Field label="Profile name" value={name} onChange={(e) => setName(e.target.value)} /><button className="primary-btn w-full" onClick={() => name.trim() && onSave(name.trim())}>Save</button></div></Modal>;
}
