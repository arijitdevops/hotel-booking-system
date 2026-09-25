import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { logger } from '../../config/logger';
import { db } from '../../db/client';
import { bookings, payments } from '../../db/schema';
import type { PaymentMethod } from '../../domain/enums';
import { ConflictError, NotFoundError } from '../../errors/AppError';
import { assertOwnershipOrAdmin, type AuthenticatedUser } from '../../middleware/auth';
import { formatMinorUnits, fromMinorUnits, toMinorUnits } from '../../utils/money';
import { bookingWith, toBookingDto, type BookingDto } from '../bookings/bookings.mapper';
import type { CreatePaymentInput } from './payments.schema';

export interface PaymentResult {
  payment: {
    id: string;
    status: string;
    method: PaymentMethod;
    amount: number;
    transactionRef: string;
    paidAt: string | null;
  };
  booking: BookingDto;
}

/**
 * Simulated payment provider.
 *
 * No network call is made and no card data is persisted. The outcome is
 * deterministic so the flow can be demonstrated both ways: a card number whose
 * digits end in `0000` is declined, everything else is authorised.
 */
function authorise(input: CreatePaymentInput): { approved: boolean; declineReason?: string } {
  if (input.method !== 'CARD') {
    return { approved: true };
  }
  const digits = input.cardNumber.replace(/[^0-9]/g, '');
  if (digits.endsWith('0000')) {
    return { approved: false, declineReason: 'Card declined by the issuer' };
  }
  return { approved: true };
}

function transactionReference(): string {
  return `TXN-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

export async function payForBooking(
  reference: string,
  user: AuthenticatedUser,
  input: CreatePaymentInput,
): Promise<PaymentResult> {
  const booking = db.query.bookings
    .findFirst({ where: eq(bookings.reference, reference), with: { payment: true } })
    .sync();

  if (!booking) {
    throw new NotFoundError(`No booking exists with reference ${reference}`);
  }

  assertOwnershipOrAdmin(user, booking.userId);

  if (booking.status === 'CANCELLED') {
    throw new ConflictError('A cancelled booking cannot be paid for');
  }
  if (booking.payment && booking.payment.status === 'PAID') {
    throw new ConflictError('This booking has already been paid');
  }

  const amountMinor = toMinorUnits(booking.totalAmount);
  const outcome = authorise(input);
  const now = new Date();
  const transactionRef = transactionReference();

  const paymentData = {
    amount: formatMinorUnits(amountMinor),
    method: input.method,
    status: outcome.approved ? 'PAID' : 'FAILED',
    transactionRef,
    paidAt: outcome.approved ? now : null,
  };

  const updatedBooking = db.transaction((tx) => {
    tx.insert(payments)
      .values({ bookingId: booking.id, ...paymentData })
      .onConflictDoUpdate({ target: payments.bookingId, set: paymentData })
      .run();

    if (outcome.approved) {
      tx.update(bookings).set({ status: 'CONFIRMED' }).where(eq(bookings.id, booking.id)).run();
    }

    const row = tx.query.bookings
      .findFirst({ where: eq(bookings.id, booking.id), with: bookingWith })
      .sync();
    if (!row) {
      throw new NotFoundError(`No booking exists with reference ${reference}`);
    }
    return row;
  });

  logger.info(
    { reference, transactionRef, approved: outcome.approved },
    'Payment processed (simulated)',
  );

  if (!outcome.approved) {
    throw new ConflictError(outcome.declineReason ?? 'Payment was declined', {
      transactionRef,
      bookingReference: reference,
    });
  }

  return {
    payment: {
      id: transactionRef,
      status: 'PAID',
      method: input.method,
      amount: fromMinorUnits(amountMinor),
      transactionRef,
      paidAt: now.toISOString(),
    },
    booking: toBookingDto(updatedBooking, now),
  };
}
