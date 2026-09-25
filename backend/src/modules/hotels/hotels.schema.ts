import { z } from 'zod';

export const hotelListQuerySchema = z.object({
  city: z.string().trim().min(1).max(80).optional(),
  country: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  minStars: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const hotelSlugParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, digits and dashes'),
});

export type HotelListQuery = z.infer<typeof hotelListQuerySchema>;
export type HotelSlugParams = z.infer<typeof hotelSlugParamsSchema>;
