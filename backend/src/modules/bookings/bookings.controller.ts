import type { Request, Response } from 'express';

import { currentUser } from '../../middleware/auth';
import { parsedBody, parsedParams, parsedQuery } from '../../middleware/validate';
import * as bookingsService from './bookings.service';
import {
  bookingReferenceParamsSchema,
  cancelBookingSchema,
  createBookingSchema,
  myBookingsQuerySchema,
} from './bookings.schema';

export async function createBookingHandler(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const input = parsedBody(req, createBookingSchema);
  const result = await bookingsService.createBooking(user.id, input);
  res.status(201).json(result);
}

export async function listMyBookingsHandler(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const query = parsedQuery(req, myBookingsQuerySchema);
  const result = await bookingsService.listMyBookings(user.id, query);
  res.status(200).json(result);
}

export async function getBookingHandler(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const { reference } = parsedParams(req, bookingReferenceParamsSchema);
  const booking = await bookingsService.getBookingByReference(reference, user);
  res.status(200).json({ booking });
}

export async function cancelBookingHandler(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const { reference } = parsedParams(req, bookingReferenceParamsSchema);
  const { reason } = parsedBody(req, cancelBookingSchema);
  const result = await bookingsService.cancelBooking(reference, user, reason);
  res.status(200).json(result);
}
