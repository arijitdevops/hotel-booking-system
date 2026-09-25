import { api, buildQuery } from './client';
import type { HotelReviewsResponse, Review } from '../types';

export interface HotelReviewsParams {
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'highest' | 'lowest';
}

export interface CreateReviewPayload {
  bookingReference: string;
  rating: number;
  title: string;
  comment: string;
}

export function listHotelReviews(
  slug: string,
  params: HotelReviewsParams = {},
): Promise<HotelReviewsResponse> {
  return api.get<HotelReviewsResponse>(
    `/hotels/${encodeURIComponent(slug)}/reviews${buildQuery({ ...params })}`,
  );
}

export function createReview(payload: CreateReviewPayload): Promise<{ review: Review }> {
  return api.post<{ review: Review }>('/reviews', payload);
}

export function listMyReviews(): Promise<{ reviews: Review[] }> {
  return api.get<{ reviews: Review[] }>('/reviews/me');
}
