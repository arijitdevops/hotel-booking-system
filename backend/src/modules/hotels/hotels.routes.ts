import { Router } from 'express';

import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { listHotelReviewsHandler } from '../reviews/reviews.controller';
import { hotelReviewsQuerySchema } from '../reviews/reviews.schema';
import { getHotelHandler, listCitiesHandler, listHotelsHandler } from './hotels.controller';
import { hotelListQuerySchema, hotelSlugParamsSchema } from './hotels.schema';

export const hotelsRouter = Router();

hotelsRouter.get('/', validate({ query: hotelListQuerySchema }), asyncHandler(listHotelsHandler));

hotelsRouter.get('/cities', asyncHandler(listCitiesHandler));

hotelsRouter.get(
  '/:slug',
  validate({ params: hotelSlugParamsSchema }),
  asyncHandler(getHotelHandler),
);

hotelsRouter.get(
  '/:slug/reviews',
  validate({ params: hotelSlugParamsSchema, query: hotelReviewsQuerySchema }),
  asyncHandler(listHotelReviewsHandler),
);
