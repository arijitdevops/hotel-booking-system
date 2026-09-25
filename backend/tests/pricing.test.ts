import { describe, expect, it } from 'vitest';

import { parseDateOnly } from '../src/utils/dates';
import { toMinorUnits, formatMinorUnits, percentageOf } from '../src/utils/money';
import { quoteStay, selectRatePlanForNight, type RatePlanWindow } from '../src/utils/pricing';

const day = (value: string): Date => parseDateOnly(value);

describe('money helpers', () => {
  it('converts decimal strings to minor units without float drift', () => {
    expect(toMinorUnits('145.00')).toBe(14500);
    expect(toMinorUnits('0.1')).toBe(10);
    expect(toMinorUnits('1.005')).toBe(101);
    expect(toMinorUnits('19.99')).toBe(1999);
    expect(toMinorUnits(219)).toBe(21900);
  });

  it('accepts Decimal-like values', () => {
    const decimalLike = { toFixed: (places: number): string => (310).toFixed(places) };
    expect(toMinorUnits(decimalLike)).toBe(31000);
  });

  it('formats minor units back to a 2dp string', () => {
    expect(formatMinorUnits(14500)).toBe('145.00');
    expect(formatMinorUnits(7)).toBe('0.07');
    expect(formatMinorUnits(-250)).toBe('-2.50');
  });

  it('rounds percentages half up to the cent', () => {
    expect(percentageOf(10000, 12)).toBe(1200);
    expect(percentageOf(12345, 12)).toBe(1481);
  });
});

describe('selectRatePlanForNight', () => {
  const peak: RatePlanWindow = {
    name: 'Peak',
    startDate: day('2026-07-01'),
    endDate: day('2026-08-01'),
    priceMultiplier: 1.4,
  };
  const weekend: RatePlanWindow = {
    name: 'Weekend',
    startDate: day('2026-07-10'),
    endDate: day('2026-07-13'),
    priceMultiplier: 1.6,
  };

  it('returns null when no plan covers the night', () => {
    expect(selectRatePlanForNight(day('2026-06-30'), [peak])).toBeNull();
  });

  it('treats the window as half open', () => {
    expect(selectRatePlanForNight(day('2026-07-01'), [peak])?.name).toBe('Peak');
    expect(selectRatePlanForNight(day('2026-07-31'), [peak])?.name).toBe('Peak');
    expect(selectRatePlanForNight(day('2026-08-01'), [peak])).toBeNull();
  });

  it('prefers the most specific (shortest) window when they overlap', () => {
    expect(selectRatePlanForNight(day('2026-07-11'), [peak, weekend])?.name).toBe('Weekend');
    expect(selectRatePlanForNight(day('2026-07-20'), [peak, weekend])?.name).toBe('Peak');
  });
});

describe('quoteStay', () => {
  const base = 10000; // 100.00

  it('prices a flat stay with tax', () => {
    const quote = quoteStay({
      basePricePerNightMinor: base,
      checkIn: day('2026-05-01'),
      checkOut: day('2026-05-04'),
      taxPercent: 12,
    });

    expect(quote.nightCount).toBe(3);
    expect(quote.nights.map((night) => night.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
    expect(quote.subtotalMinor).toBe(30000);
    expect(quote.taxMinor).toBe(3600);
    expect(quote.totalMinor).toBe(33600);
  });

  it('applies a multiplier only to the nights inside the window', () => {
    const quote = quoteStay({
      basePricePerNightMinor: base,
      checkIn: day('2026-06-29'),
      checkOut: day('2026-07-03'),
      ratePlans: [
        {
          name: 'Peak',
          startDate: day('2026-07-01'),
          endDate: day('2026-08-01'),
          priceMultiplier: 1.5,
        },
      ],
      taxPercent: 0,
    });

    expect(quote.nights.map((night) => night.amountMinor)).toEqual([10000, 10000, 15000, 15000]);
    expect(quote.subtotalMinor).toBe(50000);
    expect(quote.totalMinor).toBe(50000);
  });

  it('rounds each night to a whole cent rather than the stay total', () => {
    const quote = quoteStay({
      basePricePerNightMinor: 9999,
      checkIn: day('2026-05-01'),
      checkOut: day('2026-05-03'),
      ratePlans: [
        {
          name: 'Odd',
          startDate: day('2026-05-01'),
          endDate: day('2026-05-03'),
          priceMultiplier: 1.335,
        },
      ],
      taxPercent: 7.5,
    });

    // 9999 * 1.335 = 13348.665 -> 13349 per night
    expect(quote.nights.every((night) => night.amountMinor === 13349)).toBe(true);
    expect(quote.subtotalMinor).toBe(26698);
    expect(quote.taxMinor).toBe(2002); // 26698 * 7.5% = 2002.35 -> 2002
    expect(quote.totalMinor).toBe(28700);
  });

  it('records which plan priced each night', () => {
    const quote = quoteStay({
      basePricePerNightMinor: base,
      checkIn: day('2026-07-09'),
      checkOut: day('2026-07-12'),
      ratePlans: [
        {
          name: 'Peak',
          startDate: day('2026-07-01'),
          endDate: day('2026-08-01'),
          priceMultiplier: 1.4,
        },
        {
          name: 'Weekend',
          startDate: day('2026-07-10'),
          endDate: day('2026-07-12'),
          priceMultiplier: 1.6,
        },
      ],
      taxPercent: 10,
    });

    expect(quote.nights.map((night) => night.ratePlanName)).toEqual([
      'Peak',
      'Weekend',
      'Weekend',
    ]);
  });

  it('rejects a stay that does not contain a night', () => {
    expect(() =>
      quoteStay({
        basePricePerNightMinor: base,
        checkIn: day('2026-05-01'),
        checkOut: day('2026-05-01'),
        taxPercent: 12,
      }),
    ).toThrow(/after the check-in date/i);
  });

  it('rejects a reversed range and a silly tax rate', () => {
    expect(() =>
      quoteStay({
        basePricePerNightMinor: base,
        checkIn: day('2026-05-05'),
        checkOut: day('2026-05-01'),
        taxPercent: 12,
      }),
    ).toThrow();

    expect(() =>
      quoteStay({
        basePricePerNightMinor: base,
        checkIn: day('2026-05-01'),
        checkOut: day('2026-05-02'),
        taxPercent: 120,
      }),
    ).toThrow(/between 0 and 100/i);
  });
});
