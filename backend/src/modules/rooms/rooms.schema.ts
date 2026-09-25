import { z } from 'zod';

import { differenceInNights, parseDateOnly, todayUtc } from '../../utils/dates';

/** `YYYY-MM-DD` string parsed into a UTC-midnight Date. */
export const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use the YYYY-MM-DD format')
  .transform((value, ctx) => {
    try {
      return parseDateOnly(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `"${value}" is not a real date` });
      return z.NEVER;
    }
  });

export const MAX_STAY_NIGHTS = 30;

/** Shared refinement: check-out after check-in, no past dates, sane length. */
export const stayRangeSchema = z
  .object({
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
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

export const roomSearchQuerySchema = z
  .object({
    city: z.string().trim().min(1).max(80).optional(),
    hotelSlug: z.string().trim().min(1).max(120).optional(),
    checkIn: dateOnlySchema,
    checkOut: dateOnlySchema,
    guests: z.coerce.number().int().min(1).max(10).default(2),
    maxPricePerNight: z.coerce.number().positive().optional(),
  })
  .superRefine((value, ctx) => {
    const nights = differenceInNights(value.checkIn, value.checkOut);
    if (nights <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkOut'],
        message: 'Check-out must be at least one night after check-in',
      });
    } else if (nights > MAX_STAY_NIGHTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkOut'],
        message: `Stays are limited to ${MAX_STAY_NIGHTS} nights`,
      });
    }
  });

export const roomIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export const roomQuoteQuerySchema = z
  .object({
    checkIn: dateOnlySchema.optional(),
    checkOut: dateOnlySchema.optional(),
  })
  .refine(
    (value) => (value.checkIn === undefined) === (value.checkOut === undefined),
    'Provide both checkIn and checkOut, or neither',
  );

export type RoomSearchQuery = z.infer<typeof roomSearchQuerySchema>;
export type RoomIdParams = z.infer<typeof roomIdParamsSchema>;
export type RoomQuoteQuery = z.infer<typeof roomQuoteQuerySchema>;
