import { and, asc, avg, count, desc, eq, gte, inArray, like, or, type SQL } from 'drizzle-orm';

import { db } from '../../db/client';
import { hotels, reviews, roomTypes as roomTypesTable, rooms } from '../../db/schema';
import { NotFoundError } from '../../errors/AppError';
import { parseStringArray } from '../../utils/json';
import { fromMinorUnits, toMinorUnits } from '../../utils/money';
import type { HotelListQuery } from './hotels.schema';

export interface HotelSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  country: string;
  addressLine: string;
  starRating: number;
  amenities: string[];
  imageUrl: string | null;
  fromPricePerNight: number | null;
  maxOccupancy: number;
  averageRating: number | null;
  reviewCount: number;
}

export interface RoomTypeSummary {
  id: string;
  name: string;
  description: string;
  basePricePerNight: number;
  maxOccupancy: number;
  bedConfiguration: string;
  sizeSqm: number;
  amenities: string[];
  imageUrl: string | null;
  roomCount: number;
}

export interface HotelDetail extends HotelSummary {
  checkInTime: string;
  checkOutTime: string;
  roomTypes: RoomTypeSummary[];
}

export interface PaginatedHotels {
  data: HotelSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface RatingAggregate {
  average: number | null;
  count: number;
}

function ratingsByHotel(hotelIds: string[]): Map<string, RatingAggregate> {
  const result = new Map<string, RatingAggregate>();
  if (hotelIds.length === 0) {
    return result;
  }

  const grouped = db
    .select({ hotelId: reviews.hotelId, average: avg(reviews.rating), count: count() })
    .from(reviews)
    .where(inArray(reviews.hotelId, hotelIds))
    .groupBy(reviews.hotelId)
    .all();

  for (const row of grouped) {
    result.set(row.hotelId, {
      average: row.average === null ? null : Math.round(Number(row.average) * 10) / 10,
      count: row.count,
    });
  }

  return result;
}

function cheapestRate(types: Array<{ basePricePerNight: string }>): number | null {
  if (types.length === 0) {
    return null;
  }
  const minMinor = Math.min(...types.map((type) => toMinorUnits(type.basePricePerNight)));
  return fromMinorUnits(minMinor);
}

function largestOccupancy(roomTypes: Array<{ maxOccupancy: number }>): number {
  return roomTypes.reduce((max, type) => Math.max(max, type.maxOccupancy), 0);
}

export async function listHotels(query: HotelListQuery): Promise<PaginatedHotels> {
  const conditions: SQL[] = [];

  if (query.city) {
    conditions.push(like(hotels.city, `%${query.city}%`));
  }
  if (query.country) {
    conditions.push(like(hotels.country, `%${query.country}%`));
  }
  if (query.minStars) {
    conditions.push(gte(hotels.starRating, query.minStars));
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    const anyMatch = or(
      like(hotels.name, pattern),
      like(hotels.description, pattern),
      like(hotels.city, pattern),
    );
    if (anyMatch) {
      conditions.push(anyMatch);
    }
  }
  const where = and(...conditions);

  const total = db.select({ value: count() }).from(hotels).where(where).get()?.value ?? 0;
  const rows = db.query.hotels
    .findMany({
      where,
      orderBy: [desc(hotels.starRating), asc(hotels.name)],
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
      with: {
        roomTypes: { columns: { basePricePerNight: true, maxOccupancy: true } },
      },
    })
    .sync();

  const ratings = ratingsByHotel(rows.map((hotel) => hotel.id));

  const data: HotelSummary[] = rows.map((hotel) => {
    const rating = ratings.get(hotel.id);
    return {
      id: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      description: hotel.description,
      city: hotel.city,
      country: hotel.country,
      addressLine: hotel.addressLine,
      starRating: hotel.starRating,
      amenities: parseStringArray(hotel.amenities),
      imageUrl: hotel.imageUrl,
      fromPricePerNight: cheapestRate(hotel.roomTypes),
      maxOccupancy: largestOccupancy(hotel.roomTypes),
      averageRating: rating?.average ?? null,
      reviewCount: rating?.count ?? 0,
    };
  });

  return {
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getHotelBySlug(slug: string): Promise<HotelDetail> {
  const hotel = db.query.hotels
    .findFirst({
      where: eq(hotels.slug, slug),
      with: { roomTypes: { orderBy: asc(roomTypesTable.basePricePerNight) } },
    })
    .sync();

  if (!hotel) {
    throw new NotFoundError(`No hotel exists with slug "${slug}"`);
  }

  const rating = ratingsByHotel([hotel.id]).get(hotel.id);

  const roomCounts = new Map(
    db
      .select({ roomTypeId: rooms.roomTypeId, count: count() })
      .from(rooms)
      .where(eq(rooms.hotelId, hotel.id))
      .groupBy(rooms.roomTypeId)
      .all()
      .map((row) => [row.roomTypeId, row.count] as const),
  );

  const roomTypes: RoomTypeSummary[] = hotel.roomTypes.map((type) => ({
    id: type.id,
    name: type.name,
    description: type.description,
    basePricePerNight: fromMinorUnits(toMinorUnits(type.basePricePerNight)),
    maxOccupancy: type.maxOccupancy,
    bedConfiguration: type.bedConfiguration,
    sizeSqm: type.sizeSqm,
    amenities: parseStringArray(type.amenities),
    imageUrl: type.imageUrl,
    roomCount: roomCounts.get(type.id) ?? 0,
  }));

  return {
    id: hotel.id,
    name: hotel.name,
    slug: hotel.slug,
    description: hotel.description,
    city: hotel.city,
    country: hotel.country,
    addressLine: hotel.addressLine,
    starRating: hotel.starRating,
    amenities: parseStringArray(hotel.amenities),
    imageUrl: hotel.imageUrl,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    fromPricePerNight: cheapestRate(hotel.roomTypes),
    maxOccupancy: largestOccupancy(hotel.roomTypes),
    averageRating: rating?.average ?? null,
    reviewCount: rating?.count ?? 0,
    roomTypes,
  };
}

/** Distinct cities with at least one hotel, used by the search bar. */
export async function listCities(): Promise<Array<{ city: string; country: string; hotels: number }>> {
  return db
    .select({ city: hotels.city, country: hotels.country, hotels: count() })
    .from(hotels)
    .groupBy(hotels.city, hotels.country)
    .orderBy(asc(hotels.city))
    .all();
}
