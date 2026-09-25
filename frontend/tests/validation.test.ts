import { describe, expect, it } from 'vitest';

import { addDaysIso, todayIso } from '../src/lib/format';
import {
  cardPaymentSchema,
  fieldErrors,
  isLuhnValid,
  MAX_STAY_NIGHTS,
  passwordSchema,
  searchSchema,
} from '../src/lib/validation';

describe('isLuhnValid', () => {
  it('accepts well-known test card numbers', () => {
    expect(isLuhnValid('4242 4242 4242 4242')).toBe(true);
    expect(isLuhnValid('5555555555554444')).toBe(true);
  });

  it('rejects a mistyped number and short input', () => {
    expect(isLuhnValid('4242 4242 4242 4241')).toBe(false);
    expect(isLuhnValid('4242')).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('requires mixed case and a digit', () => {
    expect(passwordSchema.safeParse('Guest@123').success).toBe(true);
    expect(passwordSchema.safeParse('alllowercase1').success).toBe(false);
  });
});

describe('searchSchema', () => {
  const checkIn = addDaysIso(todayIso(), 7);

  it('accepts a normal future stay', () => {
    const result = searchSchema.safeParse({
      city: 'Lisbon',
      checkIn,
      checkOut: addDaysIso(checkIn, 3),
      guests: '2',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.guests).toBe(2);
  });

  it('reports check-out before check-in on the checkOut field', () => {
    const result = searchSchema.safeParse({ checkIn, checkOut: checkIn, guests: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)['checkOut']).toBe('Check-out must be after check-in');
    }
  });

  it('caps the length of a stay', () => {
    const result = searchSchema.safeParse({
      checkIn,
      checkOut: addDaysIso(checkIn, MAX_STAY_NIGHTS + 1),
      guests: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a check-in date in the past', () => {
    const result = searchSchema.safeParse({
      checkIn: addDaysIso(todayIso(), -1),
      checkOut: addDaysIso(todayIso(), 2),
      guests: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error))).toContain('checkIn');
    }
  });
});

describe('cardPaymentSchema', () => {
  it('validates a complete card form', () => {
    const result = cardPaymentSchema.safeParse({
      cardHolder: 'Marta Kowalski',
      cardNumber: '4242 4242 4242 4242',
      expiryMonth: '12',
      expiryYear: '2030',
      cvc: '123',
    });
    expect(result.success).toBe(true);
  });
});
