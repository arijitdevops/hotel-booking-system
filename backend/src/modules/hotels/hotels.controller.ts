import type { Request, Response } from 'express';

import { parsedParams, parsedQuery } from '../../middleware/validate';
import { hotelListQuerySchema, hotelSlugParamsSchema } from './hotels.schema';
import * as hotelsService from './hotels.service';

export async function listHotelsHandler(req: Request, res: Response): Promise<void> {
  const query = parsedQuery(req, hotelListQuerySchema);
  const result = await hotelsService.listHotels(query);
  res.status(200).json(result);
}

export async function getHotelHandler(req: Request, res: Response): Promise<void> {
  const { slug } = parsedParams(req, hotelSlugParamsSchema);
  const hotel = await hotelsService.getHotelBySlug(slug);
  res.status(200).json({ hotel });
}

export async function listCitiesHandler(_req: Request, res: Response): Promise<void> {
  const cities = await hotelsService.listCities();
  res.status(200).json({ cities });
}
