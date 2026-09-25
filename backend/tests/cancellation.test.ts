import { describe, expect, it } from 'vitest';

import { evaluateCancellation, type CancellationPolicy } from '../src/utils/cancellation';

const policy: CancellationPolicy = { freeCancellationHours: 48, feePercent: 25 };
const checkIn = new Date('2026-09-20T15:00:00.000Z');
const total = 40000; // 400.00

describe('evaluateCancellation', () => {
  it('is free well before the cut-off', () => {
    const outcome = evaluateCancellation({
      totalMinor: total,
      checkIn,
      now: new Date('2026-09-10T09:00:00.000Z'),
      policy,
    });

    expect(outcome.isFree).toBe(true);
    expect(outcome.reason).toBe('FREE_WINDOW');
    expect(outcome.feeMinor).toBe(0);
    expect(outcome.refundMinor).toBe(total);
  });

  it('is free exactly on the cut-off (inclusive boundary)', () => {
    const outcome = evaluateCancellation({
      totalMinor: total,
      checkIn,
      now: new Date('2026-09-18T15:00:00.000Z'),
      policy,
    });

    expect(outcome.hoursUntilCheckIn).toBe(48);
    expect(outcome.isFree).toBe(true);
    expect(outcome.feeMinor).toBe(0);
  });

  it('charges the fee one minute inside the cut-off', () => {
    const outcome = evaluateCancellation({
      totalMinor: total,
      checkIn,
      now: new Date('2026-09-18T15:01:00.000Z'),
      policy,
    });

    expect(outcome.isFree).toBe(false);
    expect(outcome.reason).toBe('LATE_CANCELLATION');
    expect(outcome.feeMinor).toBe(10000);
    expect(outcome.refundMinor).toBe(30000);
  });

  it('keeps the whole amount once the stay has started', () => {
    const outcome = evaluateCancellation({
      totalMinor: total,
      checkIn,
      now: new Date('2026-09-20T15:00:00.000Z'),
      policy,
    });

    expect(outcome.reason).toBe('STAY_STARTED');
    expect(outcome.feeMinor).toBe(total);
    expect(outcome.refundMinor).toBe(0);
    expect(outcome.hoursUntilCheckIn).toBe(0);
  });

  it('never refunds a negative amount when the fee rounds up', () => {
    const outcome = evaluateCancellation({
      totalMinor: 3,
      checkIn,
      now: new Date('2026-09-19T15:00:00.000Z'),
      policy: { freeCancellationHours: 48, feePercent: 100 },
    });

    expect(outcome.feeMinor).toBe(3);
    expect(outcome.refundMinor).toBe(0);
  });

  it('honours a zero-hour policy, where only the stay itself blocks a refund', () => {
    const outcome = evaluateCancellation({
      totalMinor: total,
      checkIn,
      now: new Date('2026-09-20T14:00:00.000Z'),
      policy: { freeCancellationHours: 0, feePercent: 25 },
    });

    expect(outcome.isFree).toBe(true);
    expect(outcome.refundMinor).toBe(total);
  });

  it('rounds the fee half up to the nearest cent', () => {
    const outcome = evaluateCancellation({
      totalMinor: 12345,
      checkIn,
      now: new Date('2026-09-19T15:00:00.000Z'),
      policy,
    });

    // 12345 * 25% = 3086.25 -> 3086
    expect(outcome.feeMinor).toBe(3086);
    expect(outcome.refundMinor).toBe(9259);
  });
});
