import { supabase } from './supabaseClient';
import type {
  Budget, BudgetDto, Category, CategoryDto, ExpenseAppData, ExpenseProfile, Frequency,
  MoneyTransaction, ProfileDto, RecurringTransaction, RecurringTransactionDto,
  ReminderSettings, ReminderSettingsDto, TransactionDto, TransactionType, UserSettingsDto
} from '../types';
import { defaultCategoryObjects, guessIconKeyFromName } from '../utils/categoryIcons';
import { addDate, advanceToFuture, formatDate, parseDateStart } from '../utils/date';

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

const ACTIVE_PROFILE_KEY = 'expense_tracker_active_profile_index';

function throwIfError(error: unknown): asserts error is null {
  if (error) {
    const e = error as { message?: string };
    throw new Error(e.message || 'Supabase request failed');
  }
}

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error);
  const uid = data.user?.id;
  if (!uid) throw new Error('Not logged in');
  return uid;
}

function toTx(dto: TransactionDto): MoneyTransaction {
  return {
    id: dto.id || generateId(),
    type: dto.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
    title: dto.title,
    category: dto.category,
    amount: Number(dto.amount || 0),
    baseCurrency: dto.base_currency || 'INR',
    displayCurrency: dto.display_currency || dto.base_currency || 'INR',
    dateMillis: parseDateStart(dto.date) ?? Date.now(),
    note: dto.note || ''
  };
}

function toBudget(dto: BudgetDto): Budget {
  return {
    id: dto.id || '',
    userId: dto.user_id,
    profileId: dto.profile_id,
    category: dto.category,
    period: dto.period,
    limitAmount: Number(dto.limit_amount || 0),
    currency: dto.currency || 'INR'
  };
}

function toRecurring(dto: RecurringTransactionDto): RecurringTransaction {
  const freq = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(String(dto.frequency).toUpperCase())
    ? String(dto.frequency).toUpperCase() as Frequency
    : 'MONTHLY';
  return {
    id: dto.id || '',
    userId: dto.user_id,
    profileId: dto.profile_id,
    type: dto.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
    title: dto.title,
    category: dto.category,
    amount: Number(dto.amount || 0),
    baseCurrency: dto.base_currency || 'INR',
    note: dto.note || '',
    frequency: freq,
    startDate: dto.start_date,
    nextDueDate: dto.next_due_date,
    isActive: Boolean(dto.is_active)
  };
}

export async function login(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  throwIfError(error);
}

export async function signUp(email: string, password: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
  });
  throwIfError(error);
}

export async function resendConfirmationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
  });
  throwIfError(error);
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  throwIfError(error);
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
}

export async function isUserLoggedIn() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`
  });
  throwIfError(error);
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  throwIfError(error);
}

export async function fetchAppData(): Promise<ExpenseAppData> {
  const uid = await getUserId();

  const { data: rawProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', uid)
    .order('name', { ascending: true });
  throwIfError(profilesError);

  let profilesDto = (rawProfiles || []) as ProfileDto[];
  if (!profilesDto.length) {
    const { data: created, error } = await supabase
      .from('profiles')
      .insert({ user_id: uid, name: 'Profile 1' })
      .select()
      .single();
    throwIfError(error);
    profilesDto = [created as ProfileDto];
  }

  const { data: settingsRows, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', uid);
  throwIfError(settingsError);
  const currencyCode = ((settingsRows || []) as UserSettingsDto[])[0]?.default_currency || 'INR';

  const profiles: ExpenseProfile[] = [];
  for (const p of profilesDto) {
    const profileId = p.id || '';
    if (profileId) await ensureDefaultCategoriesForProfile(profileId);

    const { data: catRows, error: catError } = await supabase
      .from('categories')
      .select('*')
      .eq('profile_id', profileId)
      .order('name', { ascending: true });
    throwIfError(catError);

    const remote = ((catRows || []) as CategoryDto[]).map<Category>((dto) => ({
      id: dto.id || '',
      name: dto.name,
      iconKey: dto.icon_key || guessIconKeyFromName(dto.name)
    }));
    const merged = [...remote];
    for (const def of defaultCategoryObjects) {
      if (!merged.some((c) => c.name.toLowerCase() === def.name.toLowerCase())) merged.push(def);
    }

    const { data: txRows, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('profile_id', profileId)
      .order('date', { ascending: false });
    throwIfError(txError);

    profiles.push({
      id: profileId,
      name: p.name,
      categories: merged.map((c) => c.name),
      categoryObjects: merged,
      transactions: ((txRows || []) as TransactionDto[]).map(toTx)
    });
  }

  const storedIndex = Number(localStorage.getItem(ACTIVE_PROFILE_KEY) || '0');
  return {
    currencyCode,
    activeProfileIndex: Number.isFinite(storedIndex) ? Math.min(Math.max(storedIndex, 0), profiles.length - 1) : 0,
    profiles
  };
}

export function saveActiveProfileIndex(index: number) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, String(index));
}

export async function insertTransaction(transaction: MoneyTransaction, profileId: string): Promise<MoneyTransaction> {
  const uid = await getUserId();
  const dto: TransactionDto = {
    user_id: uid,
    profile_id: profileId,
    type: transaction.type,
    title: transaction.title,
    category: transaction.category,
    amount: transaction.amount,
    base_currency: transaction.baseCurrency,
    display_currency: transaction.displayCurrency,
    date: formatDate(transaction.dateMillis),
    note: transaction.note
  };
  const { data, error } = await supabase.from('transactions').insert(dto).select().single();
  throwIfError(error);
  return toTx(data as TransactionDto);
}

export async function updateTransaction(transaction: MoneyTransaction) {
  const { error } = await supabase.from('transactions').update({
    type: transaction.type,
    title: transaction.title,
    category: transaction.category,
    amount: transaction.amount,
    base_currency: transaction.baseCurrency,
    display_currency: transaction.displayCurrency,
    date: formatDate(transaction.dateMillis),
    note: transaction.note
  }).eq('id', transaction.id);
  throwIfError(error);
}

export async function deleteTransaction(transactionId: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
  throwIfError(error);
}

export async function insertProfile(name: string): Promise<ExpenseProfile> {
  const uid = await getUserId();
  const { data, error } = await supabase.from('profiles').insert({ user_id: uid, name }).select().single();
  throwIfError(error);
  const dto = data as ProfileDto;
  await ensureDefaultCategoriesForProfile(dto.id || '');
  return { id: dto.id || '', name: dto.name, categories: defaultCategoryObjects.map((c) => c.name), categoryObjects: defaultCategoryObjects, transactions: [] };
}

export async function updateProfileName(profileId: string, name: string) {
  const { error } = await supabase.from('profiles').update({ name }).eq('id', profileId);
  throwIfError(error);
}

export async function deleteProfile(profileId: string) {
  await supabase.from('transactions').delete().eq('profile_id', profileId);
  await supabase.from('categories').delete().eq('profile_id', profileId);
  await supabase.from('budgets').delete().eq('profile_id', profileId);
  await supabase.from('recurring_transactions').delete().eq('profile_id', profileId);
  const { error } = await supabase.from('profiles').delete().eq('id', profileId);
  throwIfError(error);
}

export async function ensureDefaultCategoriesForProfile(profileId: string) {
  if (!profileId) return;
  const uid = await getUserId();
  const { data, error } = await supabase.from('categories').select('*').eq('profile_id', profileId);
  if (error) return;
  const existing = (data || []) as CategoryDto[];
  for (const def of defaultCategoryObjects) {
    const match = existing.find((c) => c.name.toLowerCase() === def.name.toLowerCase());
    if (!match) {
      await supabase.from('categories').insert({ user_id: uid, profile_id: profileId, name: def.name, icon_key: def.iconKey });
    } else if (match.id && (!match.icon_key || match.icon_key === 'other') && def.iconKey !== 'other') {
      await updateCategoryIcon(match.id, def.iconKey);
    }
  }
}

export async function insertCategory(name: string, profileId: string, iconKey = 'other'): Promise<Category> {
  const uid = await getUserId();
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: uid, profile_id: profileId, name, icon_key: iconKey })
    .select()
    .single();
  throwIfError(error);
  const dto = data as CategoryDto;
  return { id: dto.id || '', name: dto.name, iconKey: dto.icon_key || iconKey };
}

export async function updateCategoryIcon(categoryId: string, iconKey: string) {
  const { error } = await supabase.from('categories').update({ icon_key: iconKey }).eq('id', categoryId);
  throwIfError(error);
}

export async function updateCurrency(currencyCode: string) {
  const uid = await getUserId();
  const { error } = await supabase.from('user_settings').upsert({ user_id: uid, default_currency: currencyCode });
  throwIfError(error);
}

export async function fetchBudgets(profileId: string): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select('*').eq('profile_id', profileId);
  throwIfError(error);
  return ((data || []) as BudgetDto[]).map(toBudget);
}

export async function upsertBudget(budget: Budget): Promise<Budget> {
  const uid = await getUserId();
  const payload = {
    id: budget.id || undefined,
    user_id: uid,
    profile_id: budget.profileId,
    category: budget.category,
    period: budget.period || 'monthly',
    limit_amount: budget.limitAmount,
    currency: budget.currency
  };
  const { data, error } = await supabase.from('budgets').upsert(payload).select().single();
  throwIfError(error);
  return toBudget(data as BudgetDto);
}

export async function deleteBudget(budgetId: string) {
  const { error } = await supabase.from('budgets').delete().eq('id', budgetId);
  throwIfError(error);
}

export async function fetchRecurringTransactions(profileId: string): Promise<RecurringTransaction[]> {
  const { data, error } = await supabase.from('recurring_transactions').select('*').eq('profile_id', profileId);
  throwIfError(error);
  return ((data || []) as RecurringTransactionDto[]).map(toRecurring);
}

export async function addRecurringTransaction(rec: RecurringTransaction): Promise<RecurringTransaction> {
  const uid = await getUserId();
  const dto = {
    user_id: uid,
    profile_id: rec.profileId,
    type: rec.type,
    title: rec.title,
    category: rec.category,
    amount: rec.amount,
    base_currency: rec.baseCurrency,
    note: rec.note,
    frequency: rec.frequency,
    start_date: rec.startDate,
    next_due_date: rec.nextDueDate,
    is_active: rec.isActive
  };
  const { data, error } = await supabase.from('recurring_transactions').insert(dto).select().single();
  throwIfError(error);
  return toRecurring(data as RecurringTransactionDto);
}

export async function updateRecurringTransaction(rec: RecurringTransaction) {
  const { error } = await supabase.from('recurring_transactions').update({
    type: rec.type,
    title: rec.title,
    category: rec.category,
    amount: rec.amount,
    base_currency: rec.baseCurrency,
    note: rec.note,
    frequency: rec.frequency,
    start_date: rec.startDate,
    next_due_date: rec.nextDueDate,
    is_active: rec.isActive
  }).eq('id', rec.id);
  throwIfError(error);
}

export async function deleteRecurringTransaction(id: string) {
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
  throwIfError(error);
}

export async function toggleRecurringActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('recurring_transactions').update({ is_active: isActive }).eq('id', id);
  throwIfError(error);
}

export async function processDueRecurringTransactions(profileId: string): Promise<MoneyTransaction[]> {
  const uid = await getUserId();
  const today = formatDate(Date.now());
  const created: MoneyTransaction[] = [];
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('profile_id', profileId)
    .eq('is_active', true);
  throwIfError(error);

  for (const rec of (data || []) as RecurringTransactionDto[]) {
    if (!rec.next_due_date || rec.next_due_date > today) continue;
    const marker = `Auto-created from recurring: ${rec.id}`;
    const dueDateStr = rec.next_due_date;
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('profile_id', profileId)
      .eq('note', marker)
      .eq('date', dueDateStr);

    if (!existing?.length) {
      const txDto: TransactionDto = {
        user_id: uid,
        profile_id: profileId,
        type: rec.type as TransactionType,
        title: rec.title,
        category: rec.category,
        amount: rec.amount,
        base_currency: rec.base_currency,
        display_currency: rec.base_currency,
        date: dueDateStr,
        note: marker
      };
      const { data: inserted, error: insertError } = await supabase.from('transactions').insert(txDto).select().single();
      if (!insertError && inserted) created.push(toTx(inserted as TransactionDto));
    }

    const nextDue = addDate(dueDateStr, rec.frequency);
    const newNextDue = nextDue <= today ? advanceToFuture(nextDue, rec.frequency, today) : nextDue;
    await supabase.from('recurring_transactions').update({ next_due_date: newNextDue }).eq('id', rec.id || '');
  }
  return created;
}

export async function fetchReminderSettings(): Promise<ReminderSettings | null> {
  const uid = await getUserId();
  const { data, error } = await supabase.from('reminder_settings').select('*').eq('user_id', uid);
  if (error) return null;
  const dto = ((data || []) as ReminderSettingsDto[])[0];
  if (!dto) return null;
  return {
    userId: dto.user_id,
    dailyReminderEnabled: dto.daily_reminder_enabled,
    reminderHour: dto.reminder_hour,
    reminderMinute: dto.reminder_minute
  };
}

export async function upsertReminderSettings(enabled: boolean, hour: number, minute: number) {
  const uid = await getUserId();
  const { error } = await supabase.from('reminder_settings').upsert({
    user_id: uid,
    daily_reminder_enabled: enabled,
    reminder_hour: hour,
    reminder_minute: minute
  });
  throwIfError(error);
}
