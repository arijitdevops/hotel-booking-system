import { Router } from 'express';

import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createRoomHandler,
  deleteRoomHandler,
  listBookingsHandler,
  listRoomsHandler,
  statsHandler,
  updateBookingStatusHandler,
  updateRoomHandler,
} from './admin.controller';
import {
  adminBookingsQuerySchema,
  adminRoomsQuerySchema,
  createRoomSchema,
  idParamsSchema,
  updateBookingStatusSchema,
  updateRoomSchema,
} from './admin.schema';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/stats', asyncHandler(statsHandler));

adminRouter.get(
  '/bookings',
  validate({ query: adminBookingsQuerySchema }),
  asyncHandler(listBookingsHandler),
);

adminRouter.patch(
  '/bookings/:id/status',
  validate({ params: idParamsSchema, body: updateBookingStatusSchema }),
  asyncHandler(updateBookingStatusHandler),
);

adminRouter.get('/rooms', validate({ query: adminRoomsQuerySchema }), asyncHandler(listRoomsHandler));

adminRouter.post('/rooms', validate({ body: createRoomSchema }), asyncHandler(createRoomHandler));

adminRouter.patch(
  '/rooms/:id',
  validate({ params: idParamsSchema, body: updateRoomSchema }),
  asyncHandler(updateRoomHandler),
);

adminRouter.delete('/rooms/:id', validate({ params: idParamsSchema }), asyncHandler(deleteRoomHandler));
