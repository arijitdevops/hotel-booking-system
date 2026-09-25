import { hoursBetween } from './dates';
import { percentageOf } from './money';

/**
 * Cancellation policy.
 *
 * Free until `freeCancellationHours` before check-in; after that a percentage
 * of the booking total is retained; once the stay has started nothing is
 * refunded. Pure function, unit tested in tests/cancellation.test.ts.
 */

export interface CancellationPolicy {
  freeCancellationHours: number;
  feePercent: number;
}

export interface CancellationOutcome {
  isFree: boolean;
  /** Hours from `now` to check-in; negative once the stay has started. */
  hoursUntilCheckIn: number;
  feeMinor: number;
  refundMinor: number;
  reason: 'FREE_WINDOW' | 'LATE_CANCELLATION' | 'STAY_STARTED';
}

export interface EvaluateCancellationInput {
  totalMinor: number;
  checkIn: Date;
  now: Date;
  policy: CancellationPolicy;
}

export function evaluateCancellation(input: EvaluateCancellationInput): CancellationOutcome {
  const { totalMinor, checkIn, now, policy } = input;
  const hoursUntilCheckIn = hoursBetween(now, checkIn);

  if (hoursUntilCheckIn <= 0) {
    return {
      isFree: false,
      hoursUntilCheckIn,
      feeMinor: totalMinor,
      refundMinor: 0,
      reason: 'STAY_STARTED',
    };
  }

  if (hoursUntilCheckIn >= policy.freeCancellationHours) {
    return {
      isFree: true,
      hoursUntilCheckIn,
      feeMinor: 0,
      refundMinor: totalMinor,
      reason: 'FREE_WINDOW',
    };
  }

  const feeMinor = Math.min(totalMinor, percentageOf(totalMinor, policy.feePercent));
  return {
    isFree: false,
    hoursUntilCheckIn,
    feeMinor,
    refundMinor: totalMinor - feeMinor,
    reason: 'LATE_CANCELLATION',
  };
}
