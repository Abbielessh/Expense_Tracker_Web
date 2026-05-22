// ─── Category Image Map ─────────────────────────────────────────────────────
// Imports all category PNG icons from src/assets/category-icons/ and maps
// them by iconKey. Use `imageForKey(iconKey)` anywhere you need a src path.

import icFood from '../assets/category-icons/ic_cat_food.png';
import icTravel from '../assets/category-icons/ic_cat_travel.png';
import icShopping from '../assets/category-icons/ic_cat_shopping.png';
import icRent from '../assets/category-icons/ic_cat_rent.png';
import icBills from '../assets/category-icons/ic_cat_bills.png';
import icHealth from '../assets/category-icons/ic_cat_health.png';
import icEducation from '../assets/category-icons/ic_cat_education.png';
import icEntertainment from '../assets/category-icons/ic_cat_entertainment.png';
import icFuel from '../assets/category-icons/ic_cat_fuel.png';
import icOther from '../assets/category-icons/ic_cat_other.png';
import icZepto from '../assets/category-icons/ic_cat_zepto.png';
import icPersonal from '../assets/category-icons/ic_cat_personal.png';
import icIncome from '../assets/category-icons/ic_cat_income.png';

/** Maps iconKey → imported PNG path (processed by Vite at build time). */
export const categoryImageMap: Record<string, string> = {
  food: icFood,
  travel: icTravel,
  shopping: icShopping,
  rent: icRent,
  bills: icBills,
  health: icHealth,
  education: icEducation,
  entertainment: icEntertainment,
  fuel: icFuel,
  other: icOther,
  zepto: icZepto,
  personal: icPersonal,
  income: icIncome,
};

/**
 * Returns the imported PNG src for a given iconKey.
 * Falls back to the "other" icon if key is unknown.
 */
export function imageForKey(iconKey?: string | null): string {
  const key = (iconKey || 'other').toLowerCase();
  return categoryImageMap[key] ?? categoryImageMap.other;
}

/**
 * Returns the image src for a category by name, using the iconKey if provided.
 * Mirrors the signature of `iconForCategory` from categoryIcons.ts.
 */
export function imageForCategory(categoryName: string, iconKey?: string | null): string {
  // Direct key lookup
  if (iconKey) return imageForKey(iconKey);
  // Try matching category name as a key
  const nameKey = categoryName.trim().toLowerCase();
  if (categoryImageMap[nameKey]) return categoryImageMap[nameKey];
  // Fallback to other
  return categoryImageMap.other;
}
