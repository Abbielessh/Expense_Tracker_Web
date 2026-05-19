export function formatDate(millis: number): string {
  const d = new Date(millis);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateStart(dateText: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText.trim())) return null;
  const [y, m, d] = dateText.split('-').map(Number);
  const value = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(value.getTime())) return null;
  return value.getTime();
}

export function parseDateEnd(dateText: string): number | null {
  const start = parseDateStart(dateText);
  if (start == null) return null;
  const d = new Date(start);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function todayStartMillis(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMillis(millis: number): number {
  const d = new Date(millis);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function weekStartMillis(): number {
  const d = new Date();
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function monthStartMillis(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
}

export function addDate(dateStr: string, frequency: string): string {
  const start = parseDateStart(dateStr);
  if (start == null) return dateStr;
  const d = new Date(start);
  const freq = frequency.toUpperCase();
  if (freq === 'DAILY') d.setDate(d.getDate() + 1);
  if (freq === 'WEEKLY') d.setDate(d.getDate() + 7);
  if (freq === 'MONTHLY') d.setMonth(d.getMonth() + 1);
  return formatDate(d.getTime());
}

export function advanceToFuture(dateStr: string, frequency: string, today: string): string {
  let current = dateStr;
  let safety = 0;
  while (current <= today && safety < 500) {
    current = addDate(current, frequency);
    safety += 1;
  }
  return current;
}

export function sameDay(a: number, b: number): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function sameWeek(millis: number): boolean {
  const nowStart = weekStartMillis();
  const nowEnd = endOfDayMillis(Date.now());
  return millis >= nowStart && millis <= nowEnd;
}

export function sameMonth(millis: number): boolean {
  const d = new Date(millis);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}
