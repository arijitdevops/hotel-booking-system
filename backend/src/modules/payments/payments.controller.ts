import type { Request, Response } from 'express';

import { currentUser } from '../../middleware/auth';
import { parsedBody, parsedParams } from '../../middleware/validate';
import { createPaymentSchema, paymentParamsSchema } from './payments.schema';
import * as paymentsService from './payments.service';

export async function payBookingHandler(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const { bookingReference } = parsedParams(req, paymentParamsSchema);
  const input = parsedBody(req, createPaymentSchema);
  const result = await paymentsService.payForBooking(bookingReference, user, input);
  res.status(201).json(result);
}
