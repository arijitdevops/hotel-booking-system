import { z } from 'zod';

import { BOOKING_STATUSES } from '../../domain/enums';
import { differenceInNights, todayUtc } from '../../utils/dates';
import { BOOKING_REFERENCE_PATTERN } from '../../utils/bookingReference';
import { dateOnlySchema, MAX_STAY_NIGHTS } from '../rooms/rooms.schema';

export const createBookingSchema = z
  .object({
    roomId: z.string().trim().min(1, 'A room must be selected').max(64),
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
    guests: z.coerce.number().int().min(1).max(10),
    specialRequests: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    const nights = differenceInNights(value.checkIn, value.checkOut);
    if (nights <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkOut'],
        message: 'Check-out must be at least one night after check-in',
      });
      return;
    }
    if (nights > MAX_STAY_NIGHTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkOut'],
        message: `Stays are limited to ${MAX_STAY_NIGHTS} nights`,
      });
    }
    if (value.checkIn.getTime() < todayUtc().getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkIn'],
        message: 'Check-in cannot be in the past',
      });
    }
  });

export const bookingReferenceParamsSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(BOOKING_REFERENCE_PATTERN, 'Booking references look like BK-2026-0001'),
});

export const myBookingsQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  scope: z.enum(['all', 'upcoming', 'past']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type BookingReferenceParams = z.infer<typeof bookingReferenceParamsSchema>;
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
