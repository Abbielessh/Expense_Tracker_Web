export type TransactionType = 'EXPENSE' | 'INCOME';
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface MoneyTransaction {
  id: string;
  type: TransactionType;
  title: string;
  category: string;
  amount: number;
  baseCurrency: string;
  displayCurrency: string;
  dateMillis: number;
  note: string;
}

export interface Category {
  id: string;
  name: string;
  iconKey: string;
}

export interface ExpenseProfile {
  id: string;
  name: string;
  categories: string[];
  categoryObjects: Category[];
  transactions: MoneyTransaction[];
}

export interface ExpenseAppData {
  currencyCode: string;
  activeProfileIndex: number;
  profiles: ExpenseProfile[];
}

export interface Budget {
  id: string;
  userId: string;
  profileId: string;
  category: string;
  period: string;
  limitAmount: number;
  currency: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  profileId: string;
  type: TransactionType;
  title: string;
  category: string;
  amount: number;
  baseCurrency: string;
  note: string;
  frequency: Frequency;
  startDate: string;
  nextDueDate: string;
  isActive: boolean;
}

export interface ReminderSettings {
  userId: string;
  dailyReminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
}

export interface ProfileDto { id?: string; user_id: string; name: string; }
export interface CategoryDto { id?: string; user_id: string; profile_id: string; name: string; icon_key?: string | null; }
export interface TransactionDto {
  id?: string;
  user_id: string;
  profile_id: string;
  type: TransactionType | string;
  title: string;
  category: string;
  amount: number;
  base_currency: string;
  display_currency: string;
  date: string;
  note: string;
}
export interface UserSettingsDto { user_id: string; default_currency: string; }
export interface BudgetDto { id?: string; user_id: string; profile_id: string; category: string; period: string; limit_amount: number; currency: string; }
export interface RecurringTransactionDto {
  id?: string;
  user_id: string;
  profile_id: string;
  type: TransactionType | string;
  title: string;
  category: string;
  amount: number;
  base_currency: string;
  note: string;
  frequency: Frequency | string;
  start_date: string;
  next_due_date: string;
  is_active: boolean;
}
export interface ReminderSettingsDto { user_id: string; daily_reminder_enabled: boolean; reminder_hour: number; reminder_minute: number; }
