import { and, count, desc, eq, gte, like, lt, type SQL } from 'drizzle-orm';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { db, type DatabaseClient } from '../../db/client';
import { isUniqueViolation } from '../../db/errors';
import { bookings, payments } from '../../db/schema';
import type { AuthenticatedUser } from '../../middleware/auth';
import { assertOwnershipOrAdmin } from '../../middleware/auth';
import { ConflictError, NotFoundError } from '../../errors/AppError';
import {
  bookingReferenceYearPrefix,
  nextBookingReference,
} from '../../utils/bookingReference';
import { evaluateCancellation, type CancellationOutcome } from '../../utils/cancellation';
import { differenceInNights } from '../../utils/dates';
import { formatMinorUnits, fromMinorUnits, toMinorUnits } from '../../utils/money';
import { quoteStay } from '../../utils/pricing';
import { priceAndLockRoom, toQuoteDto, type QuoteDto } from '../rooms/rooms.service';
import { bookingWith, toBookingDto, type BookingDto } from './bookings.mapper';
import type { CreateBookingInput, MyBookingsQuery } from './bookings.schema';

const MAX_REFERENCE_ATTEMPTS = 3;

export interface CreatedBooking {
  booking: BookingDto;
  quote: QuoteDto;
}

export interface PaginatedBookings {
  data: BookingDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Highest reference issued this year, used to derive the next one. */
function allocateReference(client: DatabaseClient, year: number): string {
  const latest = client
    .select({ reference: bookings.reference })
    .from(bookings)
    .where(like(bookings.reference, `${bookingReferenceYearPrefix(year)}%`))
    .orderBy(desc(bookings.reference))
    .limit(1)
    .get();

  return nextBookingReference(latest?.reference ?? null, year);
}

function loadBookingWithRelations(client: DatabaseClient, where: SQL) {
  return client.query.bookings.findFirst({ where, with: bookingWith }).sync();
}

/**
 * Creates a booking.
 *
 * Availability is re-checked inside the transaction that writes the row, so two
 * guests racing for the last room cannot both succeed: the loser gets a 409.
 * Reference allocation can also collide under load, which is retried.
 */
export async function createBooking(
  userId: string,
  input: CreateBookingInput,
): Promise<CreatedBooking> {
  const nights = differenceInNights(input.checkIn, input.checkOut);

  for (let attempt = 1; attempt <= MAX_REFERENCE_ATTEMPTS; attempt += 1) {
    try {
      const created = db.transaction(
        (tx) => {
          const priced = priceAndLockRoom(
            tx,
            input.roomId,
            input.checkIn,
            input.checkOut,
            input.guests,
          );

          const reference = allocateReference(tx, input.checkIn.getUTCFullYear());

          const inserted = tx
            .insert(bookings)
            .values({
              reference,
              userId,
              roomId: priced.roomId,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              guests: input.guests,
              nights,
              totalAmount: formatMinorUnits(priced.quote.totalMinor),
              taxAmount: formatMinorUnits(priced.quote.taxMinor),
              status: 'PENDING',
              specialRequests: input.specialRequests ?? null,
            })
            .returning({ id: bookings.id })
            .get();

          const row = loadBookingWithRelations(tx, eq(bookings.id, inserted.id));
          if (!row) {
            throw new NotFoundError('Booking not found after insert');
          }
          return row;
        },
        { behavior: 'immediate' },
      );

      const quote = await rebuildQuote(created.id);
      logger.info({ reference: created.reference, userId }, 'Booking created');
      return { booking: toBookingDto(created), quote };
    } catch (error) {
      if (isUniqueViolation(error, 'reference') && attempt < MAX_REFERENCE_ATTEMPTS) {
        logger.warn({ attempt }, 'Booking reference collision, retrying');
        continue;
      }
      throw error;
    }
  }

  throw new ConflictError('Could not allocate a booking reference, please retry');
}

/** Re-derives the nightly breakdown for an existing booking. */
async function rebuildQuote(bookingId: string): Promise<QuoteDto> {
  const booking = db.query.bookings
    .findFirst({
      where: eq(bookings.id, bookingId),
      with: { room: { with: { roomType: { with: { ratePlans: true } } } } },
    })
    .sync();

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  const quote = quoteStay({
    basePricePerNightMinor: toMinorUnits(booking.room.roomType.basePricePerNight),
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    ratePlans: booking.room.roomType.ratePlans,
    taxPercent: env.TAX_PERCENT,
  });

  return toQuoteDto(quote);
}

export async function listMyBookings(
  userId: string,
  query: MyBookingsQuery,
): Promise<PaginatedBookings> {
  const now = new Date();
  const conditions: SQL[] = [eq(bookings.userId, userId)];

  if (query.status) {
    conditions.push(eq(bookings.status, query.status));
  }
  if (query.scope === 'upcoming') {
    conditions.push(gte(bookings.checkOut, now));
  } else if (query.scope === 'past') {
    conditions.push(lt(bookings.checkOut, now));
  }
  const where = and(...conditions);

  const total = db.select({ value: count() }).from(bookings).where(where).get()?.value ?? 0;
  const rows = db.query.bookings
    .findMany({
      where,
      orderBy: desc(bookings.checkIn),
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
      with: bookingWith,
    })
    .sync();

  return {
    data: rows.map((booking) => toBookingDto(booking, now)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getBookingByReference(
  reference: string,
  user: AuthenticatedUser,
): Promise<BookingDto> {
  const booking = loadBookingWithRelations(db, eq(bookings.reference, reference));

  if (!booking) {
    throw new NotFoundError(`No booking exists with reference ${reference}`);
  }

  assertOwnershipOrAdmin(user, booking.userId);
  return toBookingDto(booking);
}

export interface CancellationResult {
  booking: BookingDto;
  outcome: {
    isFree: boolean;
    reason: CancellationOutcome['reason'];
    feeAmount: number;
    refundAmount: number;
    hoursUntilCheckIn: number;
  };
}

export async function cancelBooking(
  reference: string,
  user: AuthenticatedUser,
  reason?: string,
): Promise<CancellationResult> {
  const now = new Date();

  const existing = db.query.bookings
    .findFirst({ where: eq(bookings.reference, reference), with: { payment: true } })
    .sync();

  if (!existing) {
    throw new NotFoundError(`No booking exists with reference ${reference}`);
  }

  assertOwnershipOrAdmin(user, existing.userId);

  if (existing.status === 'CANCELLED') {
    throw new ConflictError('This booking has already been cancelled');
  }
  if (existing.status === 'CHECKED_IN' || existing.status === 'CHECKED_OUT') {
    throw new ConflictError('A stay that has already started cannot be cancelled');
  }

  const outcome = evaluateCancellation({
    totalMinor: toMinorUnits(existing.totalAmount),
    checkIn: existing.checkIn,
    now,
    policy: {
      freeCancellationHours: env.FREE_CANCELLATION_HOURS,
      feePercent: env.CANCELLATION_FEE_PERCENT,
    },
  });

  const updated = db.transaction((tx) => {
    tx.update(bookings)
      .set({
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationFee: formatMinorUnits(outcome.feeMinor),
        specialRequests: reason
          ? `${existing.specialRequests ? `${existing.specialRequests}\n` : ''}Cancellation reason: ${reason}`
          : existing.specialRequests,
      })
      .where(eq(bookings.id, existing.id))
      .run();

    // A settled payment is refunded net of any fee; an unpaid one simply fails.
    if (existing.payment && existing.payment.status === 'PAID') {
      tx.update(payments)
        .set({ status: 'REFUNDED', amount: formatMinorUnits(outcome.refundMinor) })
        .where(eq(payments.id, existing.payment.id))
        .run();
    } else if (existing.payment && existing.payment.status === 'PENDING') {
      tx.update(payments)
        .set({ status: 'FAILED' })
        .where(eq(payments.id, existing.payment.id))
        .run();
    }

    const row = loadBookingWithRelations(tx, eq(bookings.id, existing.id));
    if (!row) {
      throw new NotFoundError(`No booking exists with reference ${reference}`);
    }
    return row;
  });

  logger.info(
    { reference, feeMinor: outcome.feeMinor, reason: outcome.reason },
    'Booking cancelled',
  );

  return {
    booking: toBookingDto(updated, now),
    outcome: {
      isFree: outcome.isFree,
      reason: outcome.reason,
      feeAmount: fromMinorUnits(outcome.feeMinor),
      refundAmount: fromMinorUnits(outcome.refundMinor),
      hoursUntilCheckIn: Math.round(outcome.hoursUntilCheckIn * 10) / 10,
    },
  };
}
