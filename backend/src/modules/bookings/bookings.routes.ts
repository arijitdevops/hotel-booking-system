import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  cancelBookingHandler,
  createBookingHandler,
  getBookingHandler,
  listMyBookingsHandler,
} from './bookings.controller';
import {
  bookingReferenceParamsSchema,
  cancelBookingSchema,
  createBookingSchema,
  myBookingsQuerySchema,
} from './bookings.schema';

export const bookingsRouter = Router();

bookingsRouter.use(requireAuth);

bookingsRouter.post('/', validate({ body: createBookingSchema }), asyncHandler(createBookingHandler));

bookingsRouter.get(
  '/me',
  validate({ query: myBookingsQuerySchema }),
  asyncHandler(listMyBookingsHandler),
);

bookingsRouter.get(
  '/:reference',
  validate({ params: bookingReferenceParamsSchema }),
  asyncHandler(getBookingHandler),
);

bookingsRouter.post(
  '/:reference/cancel',
  validate({ params: bookingReferenceParamsSchema, body: cancelBookingSchema }),
  asyncHandler(cancelBookingHandler),
);
