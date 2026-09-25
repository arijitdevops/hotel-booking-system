import { api, buildQuery } from './client';
import type { CityOption, HotelDetail, HotelSummary, Paginated } from '../types';

export interface HotelListParams {
  city?: string;
  country?: string;
  search?: string;
  minStars?: number;
  page?: number;
  pageSize?: number;
}

export function listHotels(params: HotelListParams = {}): Promise<Paginated<HotelSummary>> {
  return api.get<Paginated<HotelSummary>>(`/hotels${buildQuery({ ...params })}`);
}

export function getHotel(slug: string): Promise<{ hotel: HotelDetail }> {
  return api.get<{ hotel: HotelDetail }>(`/hotels/${encodeURIComponent(slug)}`);
}

export function listCities(): Promise<{ cities: CityOption[] }> {
  return api.get<{ cities: CityOption[] }>('/hotels/cities');
}
