import type { ReminderSettings } from '../types';

let timer: number | null = null;

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function scheduleBrowserReminder(settings: ReminderSettings | null) {
  if (timer != null) window.clearTimeout(timer);
  timer = null;
  if (!settings?.dailyReminderEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  const fireAt = new Date();
  fireAt.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);
  if (fireAt.getTime() <= now.getTime()) fireAt.setDate(fireAt.getDate() + 1);
  const delay = Math.min(fireAt.getTime() - now.getTime(), 2147483647);
  timer = window.setTimeout(() => {
    new Notification("Add today's expenses", { body: "Don't forget to record your spending for today." });
    scheduleBrowserReminder(settings);
  }, delay);
}
