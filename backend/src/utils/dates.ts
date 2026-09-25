/**
 * Date helpers.
 *
 * Every stay date is handled as a *calendar date* pinned to UTC midnight.
 * Keeping the whole pipeline in UTC removes the class of bugs where a guest in
 * UTC+13 books "the 4th" and the server stores the 3rd.
 */

export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Truncates any instant to UTC midnight of the same calendar day. */
export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}

/** Parses `YYYY-MM-DD` into UTC midnight. Throws on anything else. */
export function parseDateOnly(value: string): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, received "${value}"`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new RangeError(`"${value}" is not a valid calendar date`);
  }
  // Rejects overflow such as 2026-02-31, which Date happily rolls over.
  if (formatDateOnly(parsed) !== value) {
    throw new RangeError(`"${value}" is not a valid calendar date`);
  }
  return parsed;
}

/** Formats an instant as `YYYY-MM-DD` in UTC. */
export function formatDateOnly(value: Date): string {
  const isoString = value.toISOString();
  return isoString.slice(0, 10);
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}

/** Whole nights between two calendar dates; negative when reversed. */
export function differenceInNights(checkIn: Date, checkOut: Date): number {
  const from = startOfUtcDay(checkIn).getTime();
  const to = startOfUtcDay(checkOut).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * The calendar date of every night in a stay.
 * A stay of [2026-05-01, 2026-05-04) has nights on the 1st, 2nd and 3rd.
 */
export function eachNightOf(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  const last = startOfUtcDay(checkOut).getTime();
  for (let cursor = startOfUtcDay(checkIn); cursor.getTime() < last; cursor = addDays(cursor, 1)) {
    nights.push(cursor);
  }
  return nights;
}

/**
 * Half-open interval overlap: `[aStart, aEnd)` against `[bStart, bEnd)`.
 * Touching intervals (one ends exactly where the other starts) do not overlap,
 * which is what lets a room be re-let on the day a guest checks out.
 */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_HOUR;
}

/** Today at UTC midnight. */
export function todayUtc(now: Date = new Date()): Date {
  return startOfUtcDay(now);
}
