import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { Budget, ExpenseAppData, MoneyTransaction, RecurringTransaction } from './types';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import HomePage from './pages/HomePage';
import AddTransactionPage from './pages/AddTransactionPage';
import AllTransactionsPage from './pages/AllTransactionsPage';
import ReportsPage from './pages/ReportsPage';
import ProfilesPage from './pages/ProfilesPage';
import SettingsPage from './pages/SettingsPage';
import BudgetPage from './pages/BudgetPage';
import RecurringPage from './pages/RecurringPage';
import { supabase } from './lib/supabaseClient';
import * as repo from './lib/repository';
import { getRate } from './utils/currency';
import { exportCsv, exportPdf, type PdfSplitType } from './utils/exporters';
import { scheduleBrowserReminder } from './utils/notifications';

export interface AppActions {
  refresh: () => Promise<void>;
  setAppData: Dispatch<SetStateAction<ExpenseAppData | null>>;
  addTransaction: (tx: MoneyTransaction) => Promise<void>;
  updateTransaction: (tx: MoneyTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setActiveProfile: (index: number) => void;
  addProfile: (name: string) => Promise<void>;
  updateProfile: (index: number, name: string) => Promise<void>;
  deleteProfile: (index: number) => Promise<void>;
  updateCurrency: (code: string) => Promise<void>;
  exportPdf: (splitType?: PdfSplitType) => void;
  exportCsv: () => Promise<void>;
  logout: () => Promise<void>;
  setBudgets: Dispatch<SetStateAction<Budget[]>>;
  setRecurring: Dispatch<SetStateAction<RecurringTransaction[]>>;
}

export default function App() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [appData, setAppData] = useState<ExpenseAppData | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [error, setError] = useState('');

  const activeIndex = appData ? Math.min(Math.max(appData.activeProfileIndex, 0), appData.profiles.length - 1) : 0;
  const activeProfile = appData?.profiles[activeIndex] ?? null;

  const refresh = useCallback(async () => {
    setError('');
    const data = await repo.fetchAppData();
    setAppData(data);
    const profile = data.profiles[data.activeProfileIndex] || data.profiles[0];
    if (profile?.id) {
      const [b, r] = await Promise.all([repo.fetchBudgets(profile.id), repo.fetchRecurringTransactions(profile.id)]);
      setBudgets(b);
      setRecurring(r);
      const created = await repo.processDueRecurringTransactions(profile.id);
      if (created.length) {
        setAppData((current) => {
          if (!current) return current;
          const ix = current.activeProfileIndex;
          const profiles = [...current.profiles];
          profiles[ix] = { ...profiles[ix], transactions: [...profiles[ix].transactions, ...created] };
          return { ...current, profiles };
        });
        setRecurring(await repo.fetchRecurringTransactions(profile.id));
      }
    }
    const reminder = await repo.fetchReminderSettings();
    scheduleBrowserReminder(reminder);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const ok = Boolean(data.session);
      setLoggedIn(ok);
      if (ok) {
        try { await refresh(); } catch (e) { setError((e as Error).message); }
      }
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [refresh]);

  useEffect(() => {
    if (!appData || !activeProfile) return;
    const unique = new Set(activeProfile.transactions.map((t) => t.baseCurrency));
    unique.forEach((currency) => { void getRate(currency, appData.currencyCode); });
  }, [appData, activeProfile]);

  useEffect(() => {
    if (!appData || !activeProfile) return;
    (async () => {
      setBudgets(await repo.fetchBudgets(activeProfile.id));
      setRecurring(await repo.fetchRecurringTransactions(activeProfile.id));
    })().catch((e) => setError((e as Error).message));
  }, [activeProfile?.id]);

  const actions = useMemo<AppActions>(() => ({
    refresh,
    setAppData,
    setBudgets,
    setRecurring,
    addTransaction: async (tx) => {
      if (!appData || !activeProfile) return;
      const saved = await repo.insertTransaction(tx, activeProfile.id);
      setAppData((current) => {
        if (!current) return current;
        const profiles = [...current.profiles];
        profiles[activeIndex] = { ...profiles[activeIndex], transactions: [...profiles[activeIndex].transactions, saved] };
        return { ...current, profiles };
      });
      navigate('/home');
    },
    updateTransaction: async (tx) => {
      if (!appData || !activeProfile) return;
      await repo.updateTransaction(tx);
      setAppData((current) => {
        if (!current) return current;
        const profiles = [...current.profiles];
        profiles[activeIndex] = { ...profiles[activeIndex], transactions: profiles[activeIndex].transactions.map((t) => t.id === tx.id ? tx : t) };
        return { ...current, profiles };
      });
    },
    deleteTransaction: async (id) => {
      if (!appData) return;
      await repo.deleteTransaction(id);
      setAppData((current) => {
        if (!current) return current;
        const profiles = [...current.profiles];
        profiles[activeIndex] = { ...profiles[activeIndex], transactions: profiles[activeIndex].transactions.filter((t) => t.id !== id) };
        return { ...current, profiles };
      });
    },
    setActiveProfile: (index) => {
      repo.saveActiveProfileIndex(index);
      setAppData((current) => current ? { ...current, activeProfileIndex: index } : current);
      navigate('/home');
    },
    addProfile: async (name) => {
      const newProfile = await repo.insertProfile(name);
      setAppData((current) => current ? { ...current, profiles: [...current.profiles, newProfile], activeProfileIndex: current.profiles.length } : current);
      repo.saveActiveProfileIndex(appData?.profiles.length || 0);
    },
    updateProfile: async (index, name) => {
      if (!appData) return;
      const profile = appData.profiles[index];
      await repo.updateProfileName(profile.id, name);
      setAppData((current) => {
        if (!current) return current;
        const profiles = [...current.profiles]; profiles[index] = { ...profiles[index], name };
        return { ...current, profiles };
      });
    },
    deleteProfile: async (index) => {
      if (!appData || appData.profiles.length <= 1) return alert('At least one profile is required.');
      const profile = appData.profiles[index];
      await repo.deleteProfile(profile.id);
      const remaining = appData.profiles.filter((_, i) => i !== index);
      const newIndex = Math.max(0, Math.min(appData.activeProfileIndex === index ? 0 : appData.activeProfileIndex, remaining.length - 1));
      repo.saveActiveProfileIndex(newIndex);
      setAppData({ ...appData, profiles: remaining, activeProfileIndex: newIndex });
    },
    updateCurrency: async (code) => {
      await repo.updateCurrency(code);
      setAppData((current) => current ? { ...current, currencyCode: code } : current);
    },
    exportPdf: (splitType) => { if (appData && activeProfile) exportPdf(appData, activeProfile, splitType); },
    exportCsv: async () => { if (appData && activeProfile) await exportCsv(activeProfile, appData.currencyCode); },
    logout: async () => { await repo.logout(); setAppData(null); setLoggedIn(false); navigate('/login'); },
  }), [refresh, appData, activeProfile, activeIndex, navigate]);

  if (checking) return <Loading text="Checking session..." />;

  return (
    <>
      {error && <div className="fixed left-3 right-3 top-3 z-[60] rounded-2xl bg-red-600 p-3 text-sm font-bold text-white shadow-xl md:left-auto md:w-96">{error}<button className="float-right" onClick={() => setError('')}>✕</button></div>}
      <Routes>
        <Route path="/login" element={!loggedIn ? <LoginPage onLoggedIn={async () => { setLoggedIn(true); await refresh(); navigate('/home'); }} /> : <Navigate to="/home" replace />} />
        <Route path="/signup" element={!loggedIn ? <SignupPage /> : <Navigate to="/home" replace />} />
        <Route path="/auth/callback" element={<AuthCallbackPage onDone={async () => { setLoggedIn(true); await refresh(); }} />} />
        <Route path="/*" element={loggedIn && appData && activeProfile ? (
          <Layout>
            <Routes>
              <Route path="/home" element={<HomePage appData={appData} activeProfile={activeProfile} recurring={recurring} actions={actions} />} />
              <Route path="/add" element={<AddTransactionPage appData={appData} activeProfile={activeProfile} actions={actions} />} />
              <Route path="/transactions" element={<AllTransactionsPage appData={appData} activeProfile={activeProfile} actions={actions} />} />
              <Route path="/reports" element={<ReportsPage profile={activeProfile} currencyCode={appData.currencyCode} />} />
              <Route path="/profiles" element={<ProfilesPage appData={appData} actions={actions} />} />
              <Route path="/settings" element={<SettingsPage appData={appData} actions={actions} />} />
              <Route path="/budgets" element={<BudgetPage appData={appData} activeProfile={activeProfile} budgets={budgets} actions={actions} />} />
              <Route path="/recurring" element={<RecurringPage profile={activeProfile} currencyCode={appData.currencyCode} recurring={recurring} actions={actions} />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Layout>
        ) : loggedIn ? <Loading text="Loading your expenses..." /> : <Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

function Loading({ text }: { text: string }) {
  return <div className="app-bg flex min-h-screen items-center justify-center"><div className="text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" /><p className="font-semibold text-[#667085]">{text}</p></div></div>;
}
