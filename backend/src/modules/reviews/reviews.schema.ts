import { z } from 'zod';

import { BOOKING_REFERENCE_PATTERN } from '../../utils/bookingReference';

export const createReviewSchema = z.object({
  bookingReference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(BOOKING_REFERENCE_PATTERN, 'Booking references look like BK-2026-0001'),
  rating: z.coerce.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
  title: z.string().trim().min(3, 'Give your review a short title').max(120),
  comment: z.string().trim().min(10, 'Tell future guests a little more').max(2000),
});

export const hotelReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['newest', 'highest', 'lowest']).default('newest'),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type HotelReviewsQuery = z.infer<typeof hotelReviewsQuerySchema>;
