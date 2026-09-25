import { evaluateCancellation } from '../../utils/cancellation';
import { env } from '../../config/env';
import { formatDateOnly } from '../../utils/dates';
import { fromMinorUnits, toMinorUnits } from '../../utils/money';

/**
 * Shapes a booking row (with its relations) into the DTO the API returns.
 * Kept separate from the service so the admin module can reuse it.
 */

export interface BookingRelations {
  id: string;
  reference: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guests: number;
  totalAmount: string;
  taxAmount: string;
  cancellationFee: string;
  specialRequests: string | null;
  createdAt: Date;
  cancelledAt: Date | null;
  room: {
    id: string;
    roomNumber: string;
    floor: number;
    roomType: {
      id: string;
      name: string;
      bedConfiguration: string;
      maxOccupancy: number;
      imageUrl: string | null;
    };
    hotel: {
      id: string;
      name: string;
      slug: string;
      city: string;
      country: string;
      addressLine: string;
      checkInTime: string;
      checkOutTime: string;
      imageUrl: string | null;
    };
  };
  payment?: {
    id: string;
    amount: string;
    method: string;
    status: string;
    transactionRef: string;
    paidAt: Date | null;
  } | null;
  user?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface BookingDto {
  id: string;
  reference: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  totalAmount: number;
  taxAmount: number;
  cancellationFee: number;
  specialRequests: string | null;
  createdAt: string;
  cancelledAt: string | null;
  hotel: BookingRelations['room']['hotel'];
  roomType: BookingRelations['room']['roomType'];
  room: { id: string; roomNumber: string; floor: number };
  payment: {
    id: string;
    amount: number;
    method: string;
    status: string;
    transactionRef: string;
    paidAt: string | null;
  } | null;
  guest: { id: string; fullName: string; email: string } | null;
  canCancel: boolean;
  cancellation: {
    isFree: boolean;
    feeAmount: number;
    refundAmount: number;
    freeUntilHoursBeforeCheckIn: number;
  } | null;
}

const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED'];

export function toBookingDto(booking: BookingRelations, now: Date = new Date()): BookingDto {
  const totalMinor = toMinorUnits(booking.totalAmount);
  const canCancel =
    CANCELLABLE_STATUSES.includes(booking.status) && booking.checkIn.getTime() > now.getTime();

  const preview = canCancel
    ? evaluateCancellation({
        totalMinor,
        checkIn: booking.checkIn,
        now,
        policy: {
          freeCancellationHours: env.FREE_CANCELLATION_HOURS,
          feePercent: env.CANCELLATION_FEE_PERCENT,
        },
      })
    : null;

  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    checkIn: formatDateOnly(booking.checkIn),
    checkOut: formatDateOnly(booking.checkOut),
    nights: booking.nights,
    guests: booking.guests,
    totalAmount: fromMinorUnits(totalMinor),
    taxAmount: fromMinorUnits(toMinorUnits(booking.taxAmount)),
    cancellationFee: fromMinorUnits(toMinorUnits(booking.cancellationFee)),
    specialRequests: booking.specialRequests,
    createdAt: booking.createdAt.toISOString(),
    cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
    hotel: {
      id: booking.room.hotel.id,
      name: booking.room.hotel.name,
      slug: booking.room.hotel.slug,
      city: booking.room.hotel.city,
      country: booking.room.hotel.country,
      addressLine: booking.room.hotel.addressLine,
      checkInTime: booking.room.hotel.checkInTime,
      checkOutTime: booking.room.hotel.checkOutTime,
      imageUrl: booking.room.hotel.imageUrl,
    },
    roomType: {
      id: booking.room.roomType.id,
      name: booking.room.roomType.name,
      bedConfiguration: booking.room.roomType.bedConfiguration,
      maxOccupancy: booking.room.roomType.maxOccupancy,
      imageUrl: booking.room.roomType.imageUrl,
    },
    room: { id: booking.room.id, roomNumber: booking.room.roomNumber, floor: booking.room.floor },
    payment: booking.payment
      ? {
          id: booking.payment.id,
          amount: fromMinorUnits(toMinorUnits(booking.payment.amount)),
          method: booking.payment.method,
          status: booking.payment.status,
          transactionRef: booking.payment.transactionRef,
          paidAt: booking.payment.paidAt ? booking.payment.paidAt.toISOString() : null,
        }
      : null,
    guest: booking.user
      ? { id: booking.user.id, fullName: booking.user.fullName, email: booking.user.email }
      : null,
    canCancel,
    cancellation: preview
      ? {
          isFree: preview.isFree,
          feeAmount: fromMinorUnits(preview.feeMinor),
          refundAmount: fromMinorUnits(preview.refundMinor),
          freeUntilHoursBeforeCheckIn: env.FREE_CANCELLATION_HOURS,
        }
      : null,
  };
}

/** Drizzle relational `with` shape that satisfies BookingRelations. */
export const bookingWith = {
  room: { with: { roomType: true, hotel: true } },
  payment: true,
  user: { columns: { id: true, fullName: true, email: true } },
} as const;
