import { and, asc, eq, gt, gte, inArray, like, lt, type SQL } from 'drizzle-orm';

import { env } from '../../config/env';
import { db, type DatabaseClient } from '../../db/client';
import { bookings, hotels, ratePlans, roomTypes, rooms } from '../../db/schema';
import { ConflictError, NotFoundError } from '../../errors/AppError';
import { differenceInNights, formatDateOnly } from '../../utils/dates';
import { parseStringArray } from '../../utils/json';
import { fromMinorUnits, toMinorUnits } from '../../utils/money';
import { quoteStay, type RatePlanWindow, type StayQuote } from '../../utils/pricing';
import {
  filterAvailableRooms,
  isRoomAvailable,
  OCCUPYING_STATUSES,
  type BookingInterval,
} from './availability';
import type { RoomSearchQuery } from './rooms.schema';

export {
  bookingBlocksStay,
  filterAvailableRooms,
  isRoomAvailable,
  OCCUPYING_STATUSES,
} from './availability';
export type { BookingInterval } from './availability';

export interface NightlyRateDto {
  date: string;
  multiplier: number;
  amount: number;
  ratePlanName: string | null;
}

export interface QuoteDto {
  nights: NightlyRateDto[];
  nightCount: number;
  averageNightlyRate: number;
  subtotal: number;
  taxPercent: number;
  tax: number;
  total: number;
}

export function toQuoteDto(quote: StayQuote): QuoteDto {
  return {
    nights: quote.nights.map((night) => ({
      date: night.date,
      multiplier: night.multiplier,
      amount: fromMinorUnits(night.amountMinor),
      ratePlanName: night.ratePlanName,
    })),
    nightCount: quote.nightCount,
    averageNightlyRate: fromMinorUnits(Math.round(quote.subtotalMinor / quote.nightCount)),
    subtotal: fromMinorUnits(quote.subtotalMinor),
    taxPercent: quote.taxPercent,
    tax: fromMinorUnits(quote.taxMinor),
    total: fromMinorUnits(quote.totalMinor),
  };
}

export interface RoomTypeAvailability {
  hotel: {
    id: string;
    name: string;
    slug: string;
    city: string;
    country: string;
    starRating: number;
    imageUrl: string | null;
  };
  roomType: {
    id: string;
    name: string;
    description: string;
    basePricePerNight: number;
    maxOccupancy: number;
    bedConfiguration: string;
    sizeSqm: number;
    amenities: string[];
    imageUrl: string | null;
  };
  roomId: string;
  availableRoomCount: number;
  quote: QuoteDto;
}

export interface RoomSearchResult {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  results: RoomTypeAvailability[];
}

function toRatePlanWindows(
  plans: Array<{ name: string; startDate: Date; endDate: Date; priceMultiplier: number }>,
): RatePlanWindow[] {
  return plans.map((plan) => ({
    name: plan.name,
    startDate: plan.startDate,
    endDate: plan.endDate,
    priceMultiplier: plan.priceMultiplier,
  }));
}

/** Bookings that occupy any of `roomIds` during the requested window. */
function loadBlockingBookings(
  client: DatabaseClient,
  roomIds: string[],
  checkIn: Date,
  checkOut: Date,
): Map<string, BookingInterval[]> {
  const byRoom = new Map<string, BookingInterval[]>();
  if (roomIds.length === 0) {
    return byRoom;
  }

  const rows = client
    .select({
      roomId: bookings.roomId,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.roomId, roomIds),
        inArray(bookings.status, [...OCCUPYING_STATUSES]),
        // Half-open overlap, pushed down to SQL so the date indexes are used.
        lt(bookings.checkIn, checkOut),
        gt(bookings.checkOut, checkIn),
      ),
    )
    .all();

  for (const booking of rows) {
    const existing = byRoom.get(booking.roomId);
    const interval: BookingInterval = {
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: booking.status,
    };
    if (existing) {
      existing.push(interval);
    } else {
      byRoom.set(booking.roomId, [interval]);
    }
  }

  return byRoom;
}

/**
 * Searches every hotel matching the filters and returns, per room type, the
 * number of free rooms and the price of the requested stay.
 */
export async function searchAvailableRooms(query: RoomSearchQuery): Promise<RoomSearchResult> {
  const { checkIn, checkOut, guests } = query;

  const hotelConditions: SQL[] = [];
  if (query.city) {
    hotelConditions.push(like(hotels.city, `%${query.city}%`));
  }
  if (query.hotelSlug) {
    hotelConditions.push(eq(hotels.slug, query.hotelSlug));
  }

  const matchingTypeIds = db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .innerJoin(hotels, eq(roomTypes.hotelId, hotels.id))
    .where(and(gte(roomTypes.maxOccupancy, guests), ...hotelConditions))
    .all()
    .map((row) => row.id);

  const roomTypeRows =
    matchingTypeIds.length === 0
      ? []
      : db.query.roomTypes
          .findMany({
            where: inArray(roomTypes.id, matchingTypeIds),
            with: {
              hotel: true,
              ratePlans: {
                where: and(lt(ratePlans.startDate, checkOut), gt(ratePlans.endDate, checkIn)),
              },
              rooms: {
                where: eq(rooms.status, 'AVAILABLE'),
                orderBy: asc(rooms.roomNumber),
                columns: { id: true, roomNumber: true },
              },
            },
            orderBy: asc(roomTypes.basePricePerNight),
          })
          .sync();

  const allRoomIds = roomTypeRows.flatMap((type) => type.rooms.map((room) => room.id));
  const bookingsByRoom = loadBlockingBookings(db, allRoomIds, checkIn, checkOut);

  const results: RoomTypeAvailability[] = [];

  for (const roomType of roomTypeRows) {
    const freeRooms = filterAvailableRooms(roomType.rooms, bookingsByRoom, checkIn, checkOut);
    const firstFree = freeRooms[0];
    if (!firstFree) {
      continue;
    }

    const quote = quoteStay({
      basePricePerNightMinor: toMinorUnits(roomType.basePricePerNight),
      checkIn,
      checkOut,
      ratePlans: toRatePlanWindows(roomType.ratePlans),
      taxPercent: env.TAX_PERCENT,
    });

    const averageNightly = fromMinorUnits(Math.round(quote.subtotalMinor / quote.nightCount));
    if (query.maxPricePerNight !== undefined && averageNightly > query.maxPricePerNight) {
      continue;
    }

    results.push({
      hotel: {
        id: roomType.hotel.id,
        name: roomType.hotel.name,
        slug: roomType.hotel.slug,
        city: roomType.hotel.city,
        country: roomType.hotel.country,
        starRating: roomType.hotel.starRating,
        imageUrl: roomType.hotel.imageUrl,
      },
      roomType: {
        id: roomType.id,
        name: roomType.name,
        description: roomType.description,
        basePricePerNight: fromMinorUnits(toMinorUnits(roomType.basePricePerNight)),
        maxOccupancy: roomType.maxOccupancy,
        bedConfiguration: roomType.bedConfiguration,
        sizeSqm: roomType.sizeSqm,
        amenities: parseStringArray(roomType.amenities),
        imageUrl: roomType.imageUrl,
      },
      roomId: firstFree.id,
      availableRoomCount: freeRooms.length,
      quote: toQuoteDto(quote),
    });
  }

  return {
    checkIn: formatDateOnly(checkIn),
    checkOut: formatDateOnly(checkOut),
    nights: differenceInNights(checkIn, checkOut),
    guests,
    results,
  };
}

export interface RoomDetail {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  hotel: {
    id: string;
    name: string;
    slug: string;
    city: string;
    country: string;
    addressLine: string;
    starRating: number;
    checkInTime: string;
    checkOutTime: string;
    imageUrl: string | null;
  };
  roomType: {
    id: string;
    name: string;
    description: string;
    basePricePerNight: number;
    maxOccupancy: number;
    bedConfiguration: string;
    sizeSqm: number;
    amenities: string[];
    imageUrl: string | null;
  };
  quote: QuoteDto | null;
  isAvailable: boolean | null;
}

export async function getRoomDetail(
  roomId: string,
  range?: { checkIn: Date; checkOut: Date },
): Promise<RoomDetail> {
  const room = db.query.rooms
    .findFirst({
      where: eq(rooms.id, roomId),
      with: {
        hotel: true,
        // Every rate plan is loaded and the applicable window is chosen per
        // night by quoteStay.
        roomType: { with: { ratePlans: true } },
      },
    })
    .sync();

  if (!room) {
    throw new NotFoundError(`No room exists with id "${roomId}"`);
  }

  let quote: QuoteDto | null = null;
  let available: boolean | null = null;

  if (range) {
    quote = toQuoteDto(
      quoteStay({
        basePricePerNightMinor: toMinorUnits(room.roomType.basePricePerNight),
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        ratePlans: toRatePlanWindows(room.roomType.ratePlans),
        taxPercent: env.TAX_PERCENT,
      }),
    );

    const blocking = loadBlockingBookings(db, [room.id], range.checkIn, range.checkOut);
    available =
      room.status === 'AVAILABLE' &&
      isRoomAvailable(blocking.get(room.id) ?? [], range.checkIn, range.checkOut);
  }

  return {
    id: room.id,
    roomNumber: room.roomNumber,
    floor: room.floor,
    status: room.status,
    hotel: {
      id: room.hotel.id,
      name: room.hotel.name,
      slug: room.hotel.slug,
      city: room.hotel.city,
      country: room.hotel.country,
      addressLine: room.hotel.addressLine,
      starRating: room.hotel.starRating,
      checkInTime: room.hotel.checkInTime,
      checkOutTime: room.hotel.checkOutTime,
      imageUrl: room.hotel.imageUrl,
    },
    roomType: {
      id: room.roomType.id,
      name: room.roomType.name,
      description: room.roomType.description,
      basePricePerNight: fromMinorUnits(toMinorUnits(room.roomType.basePricePerNight)),
      maxOccupancy: room.roomType.maxOccupancy,
      bedConfiguration: room.roomType.bedConfiguration,
      sizeSqm: room.roomType.sizeSqm,
      amenities: parseStringArray(room.roomType.amenities),
      imageUrl: room.roomType.imageUrl,
    },
    quote,
    isAvailable: available,
  };
}

export interface PricedRoom {
  roomId: string;
  hotelId: string;
  roomTypeId: string;
  maxOccupancy: number;
  quote: StayQuote;
}

/**
 * Re-checks availability and prices the stay using the supplied client.
 *
 * Booking creation calls this *inside* an IMMEDIATE transaction, which takes
 * SQLite's write lock up front, so the check and the insert cannot be
 * separated by a competing request (even from a second server process).
 */
export function priceAndLockRoom(
  client: DatabaseClient,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  guests: number,
): PricedRoom {
  const room = client.query.rooms
    .findFirst({
      where: eq(rooms.id, roomId),
      with: {
        roomType: {
          with: {
            ratePlans: {
              where: and(lt(ratePlans.startDate, checkOut), gt(ratePlans.endDate, checkIn)),
            },
          },
        },
      },
    })
    .sync();

  if (!room) {
    throw new NotFoundError(`No room exists with id "${roomId}"`);
  }
  if (room.status !== 'AVAILABLE') {
    throw new ConflictError(`Room ${room.roomNumber} is currently ${room.status.toLowerCase()}`);
  }
  if (guests > room.roomType.maxOccupancy) {
    throw new ConflictError(
      `${room.roomType.name} sleeps up to ${room.roomType.maxOccupancy} guests`,
    );
  }

  const blocking = loadBlockingBookings(client, [roomId], checkIn, checkOut);
  if (!isRoomAvailable(blocking.get(roomId) ?? [], checkIn, checkOut)) {
    throw new ConflictError('That room was just booked for those dates. Please pick another.');
  }

  const quote = quoteStay({
    basePricePerNightMinor: toMinorUnits(room.roomType.basePricePerNight),
    checkIn,
    checkOut,
    ratePlans: toRatePlanWindows(room.roomType.ratePlans),
    taxPercent: env.TAX_PERCENT,
  });

  return {
    roomId: room.id,
    hotelId: room.hotelId,
    roomTypeId: room.roomTypeId,
    maxOccupancy: room.roomType.maxOccupancy,
    quote,
  };
}
