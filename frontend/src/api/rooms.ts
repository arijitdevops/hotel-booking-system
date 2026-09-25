import { api, buildQuery } from './client';
import type { RoomDetail, RoomSearchResponse } from '../types';

export interface RoomSearchParams {
  city?: string;
  hotelSlug?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  maxPricePerNight?: number;
}

export function searchRooms(params: RoomSearchParams): Promise<RoomSearchResponse> {
  return api.get<RoomSearchResponse>(`/rooms/search${buildQuery({ ...params })}`);
}

export function getRoom(
  id: string,
  range?: { checkIn: string; checkOut: string },
): Promise<{ room: RoomDetail }> {
  return api.get<{ room: RoomDetail }>(
    `/rooms/${encodeURIComponent(id)}${range ? buildQuery({ ...range }) : ''}`,
  );
}
