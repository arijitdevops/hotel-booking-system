import { Router } from 'express';

import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { getRoomHandler, searchRoomsHandler } from './rooms.controller';
import { roomIdParamsSchema, roomQuoteQuerySchema, roomSearchQuerySchema } from './rooms.schema';

export const roomsRouter = Router();

roomsRouter.get(
  '/search',
  validate({ query: roomSearchQuerySchema }),
  asyncHandler(searchRoomsHandler),
);

roomsRouter.get(
  '/:id',
  validate({ params: roomIdParamsSchema, query: roomQuoteQuerySchema }),
  asyncHandler(getRoomHandler),
);
