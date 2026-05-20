import { useEffect, useState } from 'react';
import type { PdfSplitType } from '../utils/exporters';
import type { AppActions } from '../App';
import type { ExpenseAppData } from '../types';
import Modal from '../components/Modal';
import { Field, SelectField } from '../components/FormFields';
import { commonCurrencies } from '../utils/currency';
import * as repo from '../lib/repository';
import { requestNotificationPermission, scheduleBrowserReminder } from '../utils/notifications';

export default function SettingsPage({ appData, actions }: { appData: ExpenseAppData; actions: AppActions }) {
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [hour12, setHour12] = useState(9);
  const [minute, setMinute] = useState(0);
  const [isPm, setIsPm] = useState(true);
  const [reminderMessage, setReminderMessage] = useState('');
  const [pdfSplitType, setPdfSplitType] = useState<PdfSplitType>('FULL');

  useEffect(() => { repo.fetchReminderSettings().then((s) => { if (!s) return; setReminderEnabled(s.dailyReminderEnabled); const h = s.reminderHour; setHour12(h === 0 ? 12 : h > 12 ? h - 12 : h); setMinute(s.reminderMinute); setIsPm(h >= 12); }).catch(() => {}); }, []);

  const hour24 = !isPm && hour12 === 12 ? 0 : isPm && hour12 !== 12 ? hour12 + 12 : hour12;
  const display = `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;

  async function saveReminder(enabled = reminderEnabled) {
    if (enabled) {
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') { setReminderMessage('⚠️ Notification permission is required for browser reminders.'); return; }
    }
    setReminderEnabled(enabled);
    await repo.upsertReminderSettings(enabled, hour24, minute);
    scheduleBrowserReminder({ userId: '', dailyReminderEnabled: enabled, reminderHour: hour24, reminderMinute: minute });
    setReminderMessage(enabled ? 'Daily reminder enabled ✓' : 'Daily reminder disabled');
  }

  return <div className="screen space-y-4"><h1 className="text-[28px] font-extrabold">Settings</h1><SettingCard title="Global Currency" subtitle={`Current: ${appData.currencyCode}`} onClick={() => setCurrencyOpen(true)} /><SettingCard title="Budget Limits" subtitle="Set monthly spending limits per category" onClick={() => location.assign('/budgets')} /><SettingCard title="🔄 Recurring Expenses" subtitle="Manage repeating bills, EMI, subscriptions" onClick={() => location.assign('/recurring')} />
    <div className="card space-y-3"><h2 className="text-lg font-extrabold">🔔 Daily Reminder</h2><p className="text-sm text-[#667085]">Get a daily notification to record your expenses. Browser reminders work while the app/browser is active.</p><div className="flex items-center justify-between"><span className="font-semibold">Enable daily reminder</span><input type="checkbox" checked={reminderEnabled} onChange={(e) => saveReminder(e.target.checked)} className="h-6 w-6 accent-blue-600" /></div><p className="label">Reminder time</p><div className="grid grid-cols-3 gap-2"><SelectField label="Hour" value={hour12} onChange={(e) => setHour12(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}</SelectField><SelectField label="Min" value={minute} onChange={(e) => setMinute(Number(e.target.value))}>{[0,5,10,15,20,25,30,35,40,45,50,55].map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}</SelectField><SelectField label="AM/PM" value={isPm ? 'PM' : 'AM'} onChange={(e) => setIsPm(e.target.value === 'PM')}><option>AM</option><option>PM</option></SelectField></div><p className="text-sm font-bold text-[#2563EB]">Selected: {display}</p><button className="primary-btn w-full" onClick={() => saveReminder(reminderEnabled)}>Save Reminder Settings</button>{reminderMessage && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{reminderMessage}</p>}</div>
    <div className="card space-y-3"><h2 className="text-lg font-extrabold">Export Data</h2><p className="text-sm text-[#667085]">Download a PDF or CSV report for the active profile</p><div><label className="label">Report Split Type</label><select id="pdf-split-type" className="field" value={pdfSplitType} onChange={(e) => setPdfSplitType(e.target.value as PdfSplitType)}><option value="FULL">Full Report</option><option value="DAY">Day-wise Split</option><option value="WEEK">Week-wise Split</option><option value="MONTH">Month-wise Split</option></select></div><button className="primary-btn w-full bg-[#00A3FF]" onClick={() => actions.exportPdf(pdfSplitType)}>Export PDF Report</button><button className="success-btn w-full" onClick={actions.exportCsv}>Export CSV / Excel</button></div>
    <div className="card space-y-3"><h2 className="text-lg font-extrabold">Account</h2><button className="primary-btn w-full bg-[#6366F1]" onClick={() => setPasswordOpen(true)}>Change Password</button><button className="danger-btn w-full" onClick={actions.logout}>Logout</button></div>
    <div className="card text-center"><p className="font-extrabold">Expense Tracker App</p><p className="text-sm text-[#667085]">Version 1.0 Web</p></div>
    {currencyOpen && <CurrencyModal current={appData.currencyCode} onClose={() => setCurrencyOpen(false)} onSave={async (code) => { await actions.updateCurrency(code); setCurrencyOpen(false); }} />}
    {passwordOpen && <PasswordModal onClose={() => setPasswordOpen(false)} />}
  </div>;
}

function SettingCard({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) { return <button onClick={onClick} className="card w-full text-left"><p className="text-lg font-extrabold">{title}</p><p className="mt-1 text-sm text-[#667085]">{subtitle}</p></button>; }

function CurrencyModal({ current, onClose, onSave }: { current: string; onClose: () => void; onSave: (code: string) => Promise<void> }) {
  const [code, setCode] = useState(current);
  return <Modal title="Change Global Currency" onClose={onClose}><div className="space-y-4"><div className="grid grid-cols-4 gap-2">{commonCurrencies.map((c) => <button className={`chip ${code === c ? 'chip-active' : ''}`} key={c} onClick={() => setCode(c)}>{c}</button>)}</div><Field label="Custom currency code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><button className="primary-btn w-full" onClick={() => onSave(code.trim().toUpperCase())}>Apply</button></div></Modal>;
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [msg, setMsg] = useState('');
  return <Modal title="Change Password" onClose={onClose}><div className="space-y-4"><p className="text-sm text-[#667085]">Enter a new password for your account.</p><Field label="New Password" type="password" value={p1} onChange={(e) => setP1(e.target.value)} /><Field label="Confirm Password" type="password" value={p2} onChange={(e) => setP2(e.target.value)} /><p className="text-xs text-slate-500">Password must be at least 6 characters.</p>{msg && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{msg}</p>}<button className="primary-btn w-full" onClick={async () => { if (p1.length < 6) return setMsg('Password must be at least 6 characters.'); if (p1 !== p2) return setMsg('Passwords do not match.'); try { await repo.updatePassword(p1); setMsg('Password changed successfully.'); } catch (e) { setMsg((e as Error).message); } }}>Update Password</button></div></Modal>;
}
