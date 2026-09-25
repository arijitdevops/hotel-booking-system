import { describe, expect, it } from 'vitest';

import {
  bookingBlocksStay,
  filterAvailableRooms,
  isBlockingStatus,
  isRoomAvailable,
  type BookingInterval,
} from '../src/modules/rooms/availability';
import { intervalsOverlap } from '../src/utils/dates';
import { parseDateOnly } from '../src/utils/dates';

const day = (value: string): Date => parseDateOnly(value);

const confirmed = (checkIn: string, checkOut: string): BookingInterval => ({
  checkIn: day(checkIn),
  checkOut: day(checkOut),
  status: 'CONFIRMED',
});

describe('intervalsOverlap', () => {
  it('is false for intervals that merely touch', () => {
    expect(
      intervalsOverlap(day('2026-03-01'), day('2026-03-05'), day('2026-03-05'), day('2026-03-08')),
    ).toBe(false);
    expect(
      intervalsOverlap(day('2026-03-05'), day('2026-03-08'), day('2026-03-01'), day('2026-03-05')),
    ).toBe(false);
  });

  it('is true when one night is shared', () => {
    expect(
      intervalsOverlap(day('2026-03-01'), day('2026-03-06'), day('2026-03-05'), day('2026-03-08')),
    ).toBe(true);
  });
});

describe('bookingBlocksStay', () => {
  const existing = confirmed('2026-03-10', '2026-03-15');

  it('allows a stay that ends on the existing check-in day', () => {
    expect(bookingBlocksStay(existing, day('2026-03-05'), day('2026-03-10'))).toBe(false);
  });

  it('allows a stay that starts on the existing check-out day', () => {
    expect(bookingBlocksStay(existing, day('2026-03-15'), day('2026-03-18'))).toBe(false);
  });

  it('blocks a stay that overlaps by a single night', () => {
    expect(bookingBlocksStay(existing, day('2026-03-09'), day('2026-03-11'))).toBe(true);
    expect(bookingBlocksStay(existing, day('2026-03-14'), day('2026-03-16'))).toBe(true);
  });

  it('blocks an identical stay and an enclosing stay', () => {
    expect(bookingBlocksStay(existing, day('2026-03-10'), day('2026-03-15'))).toBe(true);
    expect(bookingBlocksStay(existing, day('2026-03-01'), day('2026-03-31'))).toBe(true);
  });

  it('blocks a stay entirely inside the existing one', () => {
    expect(bookingBlocksStay(existing, day('2026-03-11'), day('2026-03-13'))).toBe(true);
  });

  it('ignores cancelled bookings', () => {
    const cancelled: BookingInterval = { ...existing, status: 'CANCELLED' };
    expect(bookingBlocksStay(cancelled, day('2026-03-11'), day('2026-03-13'))).toBe(false);
  });

  it('treats every non-cancelled status as occupying', () => {
    for (const status of ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']) {
      expect(isBlockingStatus(status)).toBe(true);
      expect(bookingBlocksStay({ ...existing, status }, day('2026-03-11'), day('2026-03-13'))).toBe(
        true,
      );
    }
    expect(isBlockingStatus('CANCELLED')).toBe(false);
  });

  it('ignores the time of day on stored timestamps', () => {
    const withTime: BookingInterval = {
      checkIn: new Date('2026-03-10T15:00:00.000Z'),
      checkOut: new Date('2026-03-15T11:00:00.000Z'),
      status: 'CONFIRMED',
    };
    expect(bookingBlocksStay(withTime, day('2026-03-15'), day('2026-03-17'))).toBe(false);
    expect(bookingBlocksStay(withTime, day('2026-03-14'), day('2026-03-17'))).toBe(true);
  });
});

describe('isRoomAvailable', () => {
  const bookings = [confirmed('2026-04-01', '2026-04-04'), confirmed('2026-04-10', '2026-04-12')];

  it('is true when the stay fits in the gap', () => {
    expect(isRoomAvailable(bookings, day('2026-04-04'), day('2026-04-10'))).toBe(true);
  });

  it('is false when the stay straddles a booking', () => {
    expect(isRoomAvailable(bookings, day('2026-04-03'), day('2026-04-11'))).toBe(false);
  });

  it('is true for a room with no bookings at all', () => {
    expect(isRoomAvailable([], day('2026-04-03'), day('2026-04-11'))).toBe(true);
  });
});

describe('filterAvailableRooms', () => {
  it('keeps only rooms without a clashing booking, in order', () => {
    const rooms = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
    const byRoom = new Map<string, BookingInterval[]>([
      ['r1', [confirmed('2026-05-01', '2026-05-04')]],
      ['r2', [confirmed('2026-05-04', '2026-05-06')]],
    ]);

    const free = filterAvailableRooms(rooms, byRoom, day('2026-05-02'), day('2026-05-04'));
    expect(free.map((room) => room.id)).toEqual(['r2', 'r3']);
  });
});
