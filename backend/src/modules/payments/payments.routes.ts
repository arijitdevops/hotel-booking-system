import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { payBookingHandler } from './payments.controller';
import { createPaymentSchema, paymentParamsSchema } from './payments.schema';

export const paymentsRouter = Router();

paymentsRouter.post(
  '/:bookingReference',
  requireAuth,
  validate({ params: paymentParamsSchema, body: createPaymentSchema }),
  asyncHandler(payBookingHandler),
);
