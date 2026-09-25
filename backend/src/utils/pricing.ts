import { BadRequestError } from '../errors/AppError';
import { differenceInNights, eachNightOf, formatDateOnly, startOfUtcDay } from './dates';
import { percentageOf } from './money';

/**
 * Nightly pricing.
 *
 * Pure, dependency free and fully unit tested (tests/pricing.test.ts). All
 * arithmetic is in integer minor units; the only float in sight is the rate
 * plan multiplier, and every product of it is rounded to a whole cent
 * immediately.
 */

export interface RatePlanWindow {
  /** Inclusive start of the window. */
  startDate: Date;
  /** Exclusive end of the window. */
  endDate: Date;
  priceMultiplier: number;
  name?: string;
}

export interface NightlyRate {
  /** Calendar date of the night, `YYYY-MM-DD`. */
  date: string;
  multiplier: number;
  /** Price for this night in minor units, tax excluded. */
  amountMinor: number;
  ratePlanName: string | null;
}

export interface StayQuote {
  nights: NightlyRate[];
  nightCount: number;
  baseRateMinor: number;
  subtotalMinor: number;
  taxPercent: number;
  taxMinor: number;
  totalMinor: number;
}

export interface QuoteStayInput {
  /** Rack rate per night for the room type, in minor units. */
  basePricePerNightMinor: number;
  checkIn: Date;
  checkOut: Date;
  ratePlans?: readonly RatePlanWindow[];
  taxPercent: number;
}

/**
 * Picks the rate plan that applies to a given night.
 *
 * When windows overlap the most specific one wins: the shortest window, then
 * the highest multiplier, then the name. This ordering is deterministic so the
 * quote a guest sees at checkout is the quote that is charged.
 */
export function selectRatePlanForNight(
  night: Date,
  ratePlans: readonly RatePlanWindow[],
): RatePlanWindow | null {
  const nightTime = startOfUtcDay(night).getTime();

  const applicable = ratePlans.filter((plan) => {
    const start = startOfUtcDay(plan.startDate).getTime();
    const end = startOfUtcDay(plan.endDate).getTime();
    return nightTime >= start && nightTime < end;
  });

  if (applicable.length === 0) {
    return null;
  }

  const sorted = [...applicable].sort((a, b) => {
    const spanA = startOfUtcDay(a.endDate).getTime() - startOfUtcDay(a.startDate).getTime();
    const spanB = startOfUtcDay(b.endDate).getTime() - startOfUtcDay(b.startDate).getTime();
    if (spanA !== spanB) return spanA - spanB;
    if (a.priceMultiplier !== b.priceMultiplier) return b.priceMultiplier - a.priceMultiplier;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return sorted[0] ?? null;
}

/** Builds the full price breakdown for a stay. */
export function quoteStay(input: QuoteStayInput): StayQuote {
  const { basePricePerNightMinor, checkIn, checkOut, taxPercent } = input;
  const ratePlans = input.ratePlans ?? [];

  if (!Number.isInteger(basePricePerNightMinor) || basePricePerNightMinor < 0) {
    throw new BadRequestError('Base price must be a non-negative integer amount of minor units');
  }
  if (taxPercent < 0 || taxPercent > 100) {
    throw new BadRequestError('Tax percentage must be between 0 and 100');
  }

  const nightCount = differenceInNights(checkIn, checkOut);
  if (nightCount <= 0) {
    throw new BadRequestError('Check-out date must be after the check-in date');
  }

  const nights: NightlyRate[] = eachNightOf(checkIn, checkOut).map((night) => {
    const plan = selectRatePlanForNight(night, ratePlans);
    const multiplier = plan?.priceMultiplier ?? 1;
    return {
      date: formatDateOnly(night),
      multiplier,
      amountMinor: Math.round(basePricePerNightMinor * multiplier),
      ratePlanName: plan?.name ?? null,
    };
  });

  const subtotalMinor = nights.reduce((sum, night) => sum + night.amountMinor, 0);
  const taxMinor = percentageOf(subtotalMinor, taxPercent);

  return {
    nights,
    nightCount,
    baseRateMinor: basePricePerNightMinor,
    subtotalMinor,
    taxPercent,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
  };
}
