import type { Request, Response } from 'express';

import { currentUser } from '../../middleware/auth';
import { parsedBody, parsedParams, parsedQuery } from '../../middleware/validate';
import { hotelSlugParamsSchema } from '../hotels/hotels.schema';
import { createReviewSchema, hotelReviewsQuerySchema } from './reviews.schema';
import * as reviewsService from './reviews.service';

export async function listHotelReviewsHandler(req: Request, res: Response): Promise<void> {
  const { slug } = parsedParams(req, hotelSlugParamsSchema);
  const query = parsedQuery(req, hotelReviewsQuerySchema);
  const result = await reviewsService.listHotelReviews(slug, query);
  res.status(200).json(result);
}

export async function createReviewHandler(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const input = parsedBody(req, createReviewSchema);
  const review = await reviewsService.createReview(user, input);
  res.status(201).json({ review });
}

export async function listMyReviewsHandler(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const reviews = await reviewsService.listMyReviews(user.id);
  res.status(200).json({ reviews });
}
