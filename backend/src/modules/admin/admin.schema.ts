import { z } from 'zod';

import { BOOKING_STATUSES, ROOM_STATUSES } from '../../domain/enums';
import { dateOnlySchema } from '../rooms/rooms.schema';

export const adminBookingsQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  hotelSlug: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
});

export const createRoomSchema = z.object({
  roomTypeId: z.string().trim().min(1).max(64),
  roomNumber: z.string().trim().min(1).max(12),
  floor: z.coerce.number().int().min(0).max(80).default(1),
  status: z.enum(ROOM_STATUSES).default('AVAILABLE'),
});

export const updateRoomSchema = z
  .object({
    roomNumber: z.string().trim().min(1).max(12).optional(),
    floor: z.coerce.number().int().min(0).max(80).optional(),
    status: z.enum(ROOM_STATUSES).optional(),
    roomTypeId: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

export const adminRoomsQuerySchema = z.object({
  hotelSlug: z.string().trim().min(1).max(120).optional(),
  status: z.enum(ROOM_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type AdminRoomsQuery = z.infer<typeof adminRoomsQuerySchema>;
