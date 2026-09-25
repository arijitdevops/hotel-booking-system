import { describe, expect, it } from 'vitest';

import {
  bookingReferenceYearPrefix,
  formatBookingReference,
  isBookingReference,
  nextBookingReference,
  parseBookingReference,
} from '../src/utils/bookingReference';

describe('formatBookingReference', () => {
  it('pads the sequence to four digits', () => {
    expect(formatBookingReference(2026, 1)).toBe('BK-2026-0001');
    expect(formatBookingReference(2026, 42)).toBe('BK-2026-0042');
    expect(formatBookingReference(2026, 1234)).toBe('BK-2026-1234');
  });

  it('grows past four digits rather than wrapping', () => {
    expect(formatBookingReference(2026, 12345)).toBe('BK-2026-12345');
  });

  it('rejects nonsense input', () => {
    expect(() => formatBookingReference(26, 1)).toThrow(RangeError);
    expect(() => formatBookingReference(2026, 0)).toThrow(RangeError);
    expect(() => formatBookingReference(2026, 1.5)).toThrow(RangeError);
  });
});

describe('parseBookingReference', () => {
  it('round-trips a formatted reference', () => {
    expect(parseBookingReference('BK-2026-0007')).toEqual({ year: 2026, sequence: 7 });
  });

  it('accepts lowercase and surrounding whitespace', () => {
    expect(parseBookingReference('  bk-2026-0007 ')).toEqual({ year: 2026, sequence: 7 });
  });

  it('returns null for anything else', () => {
    expect(parseBookingReference('BK-26-0007')).toBeNull();
    expect(parseBookingReference('XX-2026-0007')).toBeNull();
    expect(parseBookingReference('BK-2026-007')).toBeNull();
    expect(parseBookingReference('')).toBeNull();
  });

  it('powers the isBookingReference guard', () => {
    expect(isBookingReference('BK-2026-0001')).toBe(true);
    expect(isBookingReference('nope')).toBe(false);
  });
});

describe('nextBookingReference', () => {
  it('starts at 0001 when the year has no bookings yet', () => {
    expect(nextBookingReference(null, 2026)).toBe('BK-2026-0001');
  });

  it('increments within the same year', () => {
    expect(nextBookingReference('BK-2026-0009', 2026)).toBe('BK-2026-0010');
    expect(nextBookingReference('BK-2026-9999', 2026)).toBe('BK-2026-10000');
  });

  it('restarts the sequence in a new year', () => {
    expect(nextBookingReference('BK-2026-0412', 2027)).toBe('BK-2027-0001');
  });

  it('recovers from an unparsable stored value', () => {
    expect(nextBookingReference('legacy-reference', 2026)).toBe('BK-2026-0001');
  });
});

describe('bookingReferenceYearPrefix', () => {
  it('matches the references it is used to look up', () => {
    const prefix = bookingReferenceYearPrefix(2026);
    expect(prefix).toBe('BK-2026-');
    expect(formatBookingReference(2026, 3).startsWith(prefix)).toBe(true);
  });
});
