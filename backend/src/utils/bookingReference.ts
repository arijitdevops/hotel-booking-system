/**
 * Human readable booking references, e.g. `BK-2026-0001`.
 *
 * The sequence restarts every calendar year and is zero padded to four digits;
 * a busier year than 9999 bookings simply grows the number rather than
 * wrapping. Pure helpers, unit tested in tests/bookingReference.test.ts.
 */

export const BOOKING_REFERENCE_PREFIX = 'BK';
export const BOOKING_REFERENCE_PATTERN = /^BK-(\d{4})-(\d{4,})$/;

export interface ParsedBookingReference {
  year: number;
  sequence: number;
}

export function formatBookingReference(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError(`Booking reference year must be a four digit year, received ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`Booking reference sequence must be a positive integer, received ${sequence}`);
  }
  return `${BOOKING_REFERENCE_PREFIX}-${year}-${String(sequence).padStart(4, '0')}`;
}

export function parseBookingReference(reference: string): ParsedBookingReference | null {
  const match = BOOKING_REFERENCE_PATTERN.exec(reference.trim().toUpperCase());
  if (!match) {
    return null;
  }
  const [, year, sequence] = match;
  return { year: Number(year), sequence: Number(sequence) };
}

export function isBookingReference(value: string): boolean {
  return parseBookingReference(value) !== null;
}

/**
 * Next reference for `year`, given the highest existing reference of that year
 * (or null when it is the first booking of the year).
 */
export function nextBookingReference(latestReference: string | null, year: number): string {
  if (!latestReference) {
    return formatBookingReference(year, 1);
  }

  const parsed = parseBookingReference(latestReference);
  if (!parsed || parsed.year !== year) {
    return formatBookingReference(year, 1);
  }

  return formatBookingReference(year, parsed.sequence + 1);
}

/** Year prefix used to scope the "highest reference so far" lookup. */
export function bookingReferenceYearPrefix(year: number): string {
  return `${BOOKING_REFERENCE_PREFIX}-${year}-`;
}
