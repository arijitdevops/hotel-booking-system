import { BLOCKING_BOOKING_STATUSES, type BookingStatus } from '../../domain/enums';
import { intervalsOverlap, startOfUtcDay } from '../../utils/dates';

/**
 * Availability rules.
 *
 * A stay occupies the half-open interval `[checkIn, checkOut)`: the guest holds
 * the room on every night from check-in up to, but not including, check-out.
 * Two stays therefore clash when
 *
 *   existing.checkIn < requested.checkOut && existing.checkOut > requested.checkIn
 *
 * which means a booking that ends on the 10th and one that starts on the 10th
 * are compatible. These helpers are pure and have no database dependency so they
 * can be exercised directly (tests/availability.test.ts).
 */

export interface BookingInterval {
  checkIn: Date;
  checkOut: Date;
  status: string;
}

export function isBlockingStatus(status: string): boolean {
  return (BLOCKING_BOOKING_STATUSES as readonly string[]).includes(status);
}

/** Does this existing booking stop the requested stay from being made? */
export function bookingBlocksStay(
  booking: BookingInterval,
  requestedCheckIn: Date,
  requestedCheckOut: Date,
): boolean {
  if (!isBlockingStatus(booking.status)) {
    return false;
  }
  return intervalsOverlap(
    startOfUtcDay(booking.checkIn),
    startOfUtcDay(booking.checkOut),
    startOfUtcDay(requestedCheckIn),
    startOfUtcDay(requestedCheckOut),
  );
}

/** True when none of the supplied bookings clash with the requested stay. */
export function isRoomAvailable(
  bookings: readonly BookingInterval[],
  requestedCheckIn: Date,
  requestedCheckOut: Date,
): boolean {
  return !bookings.some((booking) => bookingBlocksStay(booking, requestedCheckIn, requestedCheckOut));
}

/** Rooms with no clashing booking, preserving input order. */
export function filterAvailableRooms<TRoom extends { id: string }>(
  rooms: readonly TRoom[],
  bookingsByRoomId: ReadonlyMap<string, readonly BookingInterval[]>,
  requestedCheckIn: Date,
  requestedCheckOut: Date,
): TRoom[] {
  return rooms.filter((room) =>
    isRoomAvailable(bookingsByRoomId.get(room.id) ?? [], requestedCheckIn, requestedCheckOut),
  );
}

/** Statuses that occupy a room, for building SQL `where` clauses. */
export const OCCUPYING_STATUSES: readonly BookingStatus[] = BLOCKING_BOOKING_STATUSES;
