import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * The sample data set is priced in euros. A real deployment would return the
 * currency alongside each amount; keeping it in one constant makes that change
 * a one-line edit.
 */
export const CURRENCY = 'EUR';

const currencyFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** `2026-05-01` or an ISO timestamp -> `1 May 2026`. */
export function formatDate(value: string): string {
  return format(parseISO(value), 'd MMM yyyy');
}

export function formatDateTime(value: string): string {
  return format(parseISO(value), 'd MMM yyyy, HH:mm');
}

export function formatShortDate(value: string): string {
  return format(parseISO(value), 'EEE d MMM');
}

/** `YYYY-MM-DD` for today, in the browser's own timezone. */
export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = parseISO(isoDate);
  date.setDate(date.getDate() + days);
  return format(date, 'yyyy-MM-dd');
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((word) => (word ? `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}` : word))
    .join(' ');
}
