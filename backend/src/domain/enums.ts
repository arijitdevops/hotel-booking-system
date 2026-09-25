/**
 * Domain enumerations.
 *
 * SQLite has no native enum type, so these unions are
 * the single source of truth: they are used by the zod request schemas, by the
 * services and by the seed script, and they are mirrored in the frontend under
 * `frontend/src/types/index.ts`.
 */

export const USER_ROLES = ['GUEST', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROOM_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that still occupy the room and therefore block availability. */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CARD', 'PAYPAL', 'BANK_TRANSFER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Transitions an administrator is allowed to apply to a booking. */
export const ADMIN_BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> =
  {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
    CHECKED_IN: ['CHECKED_OUT'],
    CHECKED_OUT: [],
    CANCELLED: [],
  };

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
