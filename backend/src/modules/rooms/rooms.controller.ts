import type { Request, Response } from 'express';

import { parsedParams, parsedQuery } from '../../middleware/validate';
import { roomIdParamsSchema, roomQuoteQuerySchema, roomSearchQuerySchema } from './rooms.schema';
import * as roomsService from './rooms.service';

export async function searchRoomsHandler(req: Request, res: Response): Promise<void> {
  const query = parsedQuery(req, roomSearchQuerySchema);
  const result = await roomsService.searchAvailableRooms(query);
  res.status(200).json(result);
}

export async function getRoomHandler(req: Request, res: Response): Promise<void> {
  const { id } = parsedParams(req, roomIdParamsSchema);
  const { checkIn, checkOut } = parsedQuery(req, roomQuoteQuerySchema);

  const room = await roomsService.getRoomDetail(
    id,
    checkIn && checkOut ? { checkIn, checkOut } : undefined,
  );

  res.status(200).json({ room });
}
