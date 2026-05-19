import type { Category } from '../types';

export const iconKeyToEmoji: Record<string, string> = {
  food: '🍔',
  travel: '🚗',
  shopping: '🛍️',
  rent: '🏠',
  bills: '⚡',
  health: '🏥',
  education: '🎓',
  entertainment: '🎬',
  fuel: '⛽',
  income: '💰',
  zepto: '🛒',
  personal: '👤',
  other: '📌'
};

const nameToIconKey: Record<string, string> = {
  food: 'food', lunch: 'food', dinner: 'food', breakfast: 'food', restaurant: 'food', grocery: 'food', groceries: 'food',
  travel: 'travel', trip: 'travel', transport: 'travel', uber: 'travel', cab: 'travel', bus: 'travel', train: 'travel',
  shopping: 'shopping', clothes: 'shopping', clothing: 'shopping', online: 'shopping', amazon: 'shopping',
  rent: 'rent', house: 'rent', home: 'rent',
  bills: 'bills', bill: 'bills', electricity: 'bills', water: 'bills', internet: 'bills', wifi: 'bills', utility: 'bills', utilities: 'bills',
  health: 'health', medical: 'health', doctor: 'health', medicine: 'health', hospital: 'health', pharmacy: 'health',
  education: 'education', school: 'education', college: 'education', course: 'education', book: 'education', books: 'education', tuition: 'education',
  entertainment: 'entertainment', movies: 'entertainment', movie: 'entertainment', netflix: 'entertainment', spotify: 'entertainment', games: 'entertainment',
  fuel: 'fuel', petrol: 'fuel', diesel: 'fuel', gas: 'fuel',
  income: 'income', salary: 'income', freelance: 'income', bonus: 'income',
  zepto: 'zepto',
  personal: 'personal', myself: 'personal', haircut: 'personal', salon: 'personal', grooming: 'personal',
  other: 'other'
};

export const defaultCategoryObjects: Category[] = [
  { id: 'default-food', name: 'Food', iconKey: 'food' },
  { id: 'default-travel', name: 'Travel', iconKey: 'travel' },
  { id: 'default-shopping', name: 'Shopping', iconKey: 'shopping' },
  { id: 'default-rent', name: 'Rent', iconKey: 'rent' },
  { id: 'default-bills', name: 'Bills', iconKey: 'bills' },
  { id: 'default-health', name: 'Health', iconKey: 'health' },
  { id: 'default-education', name: 'Education', iconKey: 'education' },
  { id: 'default-entertainment', name: 'Entertainment', iconKey: 'entertainment' },
  { id: 'default-fuel', name: 'Fuel', iconKey: 'fuel' },
  { id: 'default-zepto', name: 'Zepto', iconKey: 'zepto' },
  { id: 'default-personal', name: 'Personal', iconKey: 'personal' },
  { id: 'default-other', name: 'Other', iconKey: 'other' }
];

export const defaultCategories = defaultCategoryObjects.map((c) => c.name);

export function emojiForKey(iconKey?: string | null): string {
  return iconKeyToEmoji[(iconKey || 'other').toLowerCase()] || iconKeyToEmoji.other;
}

export function guessIconKeyFromName(name: string): string {
  const clean = name.trim().toLowerCase();
  if (!clean) return 'other';
  if (nameToIconKey[clean]) return nameToIconKey[clean];
  const match = Object.entries(nameToIconKey).find(([key]) => clean.includes(key));
  return match?.[1] || 'other';
}

export function iconForCategory(categoryName: string, iconKey?: string | null): string {
  return emojiForKey(iconKey || guessIconKeyFromName(categoryName));
}

export const iconChoices = Object.entries(iconKeyToEmoji).map(([key, emoji]) => ({ key, emoji }));
