import type { Request, Response } from 'express';

import { parsedBody, parsedParams, parsedQuery } from '../../middleware/validate';
import * as adminService from './admin.service';
import {
  adminBookingsQuerySchema,
  adminRoomsQuerySchema,
  createRoomSchema,
  idParamsSchema,
  updateBookingStatusSchema,
  updateRoomSchema,
} from './admin.schema';

export async function statsHandler(_req: Request, res: Response): Promise<void> {
  const stats = await adminService.getDashboardStats();
  res.status(200).json(stats);
}

export async function listBookingsHandler(req: Request, res: Response): Promise<void> {
  const query = parsedQuery(req, adminBookingsQuerySchema);
  const result = await adminService.listAllBookings(query);
  res.status(200).json(result);
}

export async function updateBookingStatusHandler(req: Request, res: Response): Promise<void> {
  const { id } = parsedParams(req, idParamsSchema);
  const { status } = parsedBody(req, updateBookingStatusSchema);
  const booking = await adminService.updateBookingStatus(id, status);
  res.status(200).json({ booking });
}

export async function listRoomsHandler(req: Request, res: Response): Promise<void> {
  const query = parsedQuery(req, adminRoomsQuerySchema);
  const result = await adminService.listRooms(query);
  res.status(200).json(result);
}

export async function createRoomHandler(req: Request, res: Response): Promise<void> {
  const input = parsedBody(req, createRoomSchema);
  const room = await adminService.createRoom(input);
  res.status(201).json({ room });
}

export async function updateRoomHandler(req: Request, res: Response): Promise<void> {
  const { id } = parsedParams(req, idParamsSchema);
  const input = parsedBody(req, updateRoomSchema);
  const room = await adminService.updateRoom(id, input);
  res.status(200).json({ room });
}

export async function deleteRoomHandler(req: Request, res: Response): Promise<void> {
  const { id } = parsedParams(req, idParamsSchema);
  const result = await adminService.deleteRoom(id);
  res.status(200).json(result);
}
