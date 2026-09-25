import { api, buildQuery } from './client';
import type { AdminRoom, Booking, DashboardStats, Paginated } from '../types';

export interface AdminBookingsParams {
  status?: string;
  hotelSlug?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminRoomsParams {
  hotelSlug?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function getStats(): Promise<DashboardStats> {
  return api.get<DashboardStats>('/admin/stats');
}

export function listBookings(params: AdminBookingsParams = {}): Promise<Paginated<Booking>> {
  return api.get<Paginated<Booking>>(`/admin/bookings${buildQuery({ ...params })}`);
}

export function updateBookingStatus(id: string, status: string): Promise<{ booking: Booking }> {
  return api.patch<{ booking: Booking }>(`/admin/bookings/${encodeURIComponent(id)}/status`, {
    status,
  });
}

export function listRooms(params: AdminRoomsParams = {}): Promise<Paginated<AdminRoom>> {
  return api.get<Paginated<AdminRoom>>(`/admin/rooms${buildQuery({ ...params })}`);
}

export function updateRoomStatus(id: string, status: string): Promise<{ room: AdminRoom }> {
  return api.patch<{ room: AdminRoom }>(`/admin/rooms/${encodeURIComponent(id)}`, { status });
}
