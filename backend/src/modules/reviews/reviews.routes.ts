import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createReviewHandler, listMyReviewsHandler } from './reviews.controller';
import { createReviewSchema } from './reviews.schema';

export const reviewsRouter = Router();

reviewsRouter.post(
  '/',
  requireAuth,
  validate({ body: createReviewSchema }),
  asyncHandler(createReviewHandler),
);

reviewsRouter.get('/me', requireAuth, asyncHandler(listMyReviewsHandler));
