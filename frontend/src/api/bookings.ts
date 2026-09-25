import { api, buildQuery } from './client';
import type {
  Booking,
  CancellationResponse,
  CreateBookingResponse,
  Paginated,
  PaymentResponse,
} from '../types';

export interface CreateBookingPayload {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  specialRequests?: string;
}

export interface MyBookingsParams {
  status?: string;
  scope?: 'all' | 'upcoming' | 'past';
  page?: number;
  pageSize?: number;
}

export type PaymentPayload =
  | {
      method: 'CARD';
      cardHolder: string;
      cardNumber: string;
      expiryMonth: number;
      expiryYear: number;
      cvc: string;
    }
  | { method: 'PAYPAL' | 'BANK_TRANSFER'; accountReference: string };

export function createBooking(payload: CreateBookingPayload): Promise<CreateBookingResponse> {
  return api.post<CreateBookingResponse>('/bookings', payload);
}

export function listMyBookings(params: MyBookingsParams = {}): Promise<Paginated<Booking>> {
  return api.get<Paginated<Booking>>(`/bookings/me${buildQuery({ ...params })}`);
}

export function getBooking(reference: string): Promise<{ booking: Booking }> {
  return api.get<{ booking: Booking }>(`/bookings/${encodeURIComponent(reference)}`);
}

export function cancelBooking(reference: string, reason?: string): Promise<CancellationResponse> {
  return api.post<CancellationResponse>(
    `/bookings/${encodeURIComponent(reference)}/cancel`,
    reason ? { reason } : {},
  );
}

export function payForBooking(
  reference: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  return api.post<PaymentResponse>(`/payments/${encodeURIComponent(reference)}`, payload);
}
