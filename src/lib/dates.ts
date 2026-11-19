import { format, parseISO, addDays, startOfWeek, differenceInCalendarDays } from 'date-fns';

/** Local calendar date as YYYY-MM-DD */
export const toKey = (d: Date = new Date()) => format(d, 'yyyy-MM-dd');
export const todayKey = () => toKey(new Date());
export const fromKey = (k: string) => parseISO(k);
export const shiftKey = (k: string, days: number) => toKey(addDays(fromKey(k), days));
export const weekdayOf = (k: string) => fromKey(k).getDay();
export const weekStartKey = (k: string) => toKey(startOfWeek(fromKey(k), { weekStartsOn: 1 }));
export const daysBetween = (a: string, b: string) => differenceInCalendarDays(fromKey(b), fromKey(a));
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function relativeLabel(k: string): string {
  const diff = daysBetween(k, todayKey());
  if (diff === 0) return 'Today';
  if (diff === 1) return "Y'day";
  return format(fromKey(k), 'EEE');
}

export function prettyDate(k: string, pattern = 'EEE, MMM d') {
  return format(fromKey(k), pattern);
}
