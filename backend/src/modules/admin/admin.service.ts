import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  like,
  lt,
  lte,
  ne,
  or,
  type SQL,
} from 'drizzle-orm';

import { logger } from '../../config/logger';
import { db } from '../../db/client';
import { bookings, hotels, roomTypes, rooms, users } from '../../db/schema';
import {
  ADMIN_BOOKING_TRANSITIONS,
  isBookingStatus,
  type BookingStatus,
} from '../../domain/enums';
import { ConflictError, NotFoundError } from '../../errors/AppError';
import { addDays, formatDateOnly, todayUtc } from '../../utils/dates';
import { fromMinorUnits, toMinorUnits } from '../../utils/money';
import { bookingWith, toBookingDto, type BookingDto } from '../bookings/bookings.mapper';
import { OCCUPYING_STATUSES } from '../rooms/availability';
import type {
  AdminBookingsQuery,
  AdminRoomsQuery,
  CreateRoomInput,
  UpdateRoomInput,
} from './admin.schema';

export interface DashboardStats {
  generatedAt: string;
  totals: {
    hotels: number;
    rooms: number;
    roomTypes: number;
    guests: number;
    bookings: number;
  };
  bookingsByStatus: Record<string, number>;
  revenue: {
    currencyMinorUnits: 'cents';
    confirmedTotal: number;
    collectedTotal: number;
    averageBookingValue: number;
    last6Months: Array<{ month: string; bookings: number; revenue: number }>;
  };
  occupancy: {
    date: string;
    occupiedRooms: number;
    bookableRooms: number;
    rate: number;
  };
  arrivalsToday: number;
  departuresToday: number;
  recentBookings: BookingDto[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayUtc();
  const tomorrow = addDays(today, 1);
  const sixMonthsAgo = addDays(today, -183);

  const countOf = (table: typeof hotels | typeof rooms | typeof roomTypes | typeof users | typeof bookings, where?: SQL) =>
    db.select({ value: count() }).from(table).where(where).get()?.value ?? 0;

  const totals = {
    hotels: countOf(hotels),
    rooms: countOf(rooms),
    roomTypes: countOf(roomTypes),
    guests: countOf(users, eq(users.role, 'GUEST')),
    bookings: countOf(bookings),
  };

  const statusGroups = db
    .select({ status: bookings.status, count: count() })
    .from(bookings)
    .groupBy(bookings.status)
    .all();

  const bookableRooms = countOf(rooms, eq(rooms.status, 'AVAILABLE'));
  const occupiedRooms = countOf(
    bookings,
    and(
      inArray(bookings.status, [...OCCUPYING_STATUSES]),
      lte(bookings.checkIn, today),
      gt(bookings.checkOut, today),
    ),
  );
  const arrivalsToday = countOf(
    bookings,
    and(gte(bookings.checkIn, today), lt(bookings.checkIn, tomorrow), ne(bookings.status, 'CANCELLED')),
  );
  const departuresToday = countOf(
    bookings,
    and(gte(bookings.checkOut, today), lt(bookings.checkOut, tomorrow), ne(bookings.status, 'CANCELLED')),
  );

  const recentBookings = db.query.bookings
    .findMany({ orderBy: desc(bookings.createdAt), limit: 8, with: bookingWith })
    .sync();

  const revenueRows = db.query.bookings
    .findMany({
      where: and(ne(bookings.status, 'CANCELLED'), gte(bookings.createdAt, sixMonthsAgo)),
      columns: { createdAt: true, totalAmount: true },
      with: { payment: { columns: { status: true } } },
    })
    .sync();

  const bookingsByStatus: Record<string, number> = {};
  for (const row of statusGroups) {
    bookingsByStatus[row.status] = row.count;
  }

  let confirmedMinor = 0;
  let collectedMinor = 0;
  const monthly = new Map<string, { bookings: number; revenueMinor: number }>();

  for (const row of revenueRows) {
    const amountMinor = toMinorUnits(row.totalAmount);
    confirmedMinor += amountMinor;
    if (row.payment?.status === 'PAID') {
      collectedMinor += amountMinor;
    }
    const month = row.createdAt.toISOString().slice(0, 7);
    const bucket = monthly.get(month) ?? { bookings: 0, revenueMinor: 0 };
    bucket.bookings += 1;
    bucket.revenueMinor += amountMinor;
    monthly.set(month, bucket);
  }

  const last6Months = [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, bucket]) => ({
      month,
      bookings: bucket.bookings,
      revenue: fromMinorUnits(bucket.revenueMinor),
    }));

  return {
    generatedAt: new Date().toISOString(),
    totals,
    bookingsByStatus,
    revenue: {
      currencyMinorUnits: 'cents',
      confirmedTotal: fromMinorUnits(confirmedMinor),
      collectedTotal: fromMinorUnits(collectedMinor),
      averageBookingValue:
        revenueRows.length === 0
          ? 0
          : fromMinorUnits(Math.round(confirmedMinor / revenueRows.length)),
      last6Months,
    },
    occupancy: {
      date: formatDateOnly(today),
      occupiedRooms,
      bookableRooms,
      rate: bookableRooms === 0 ? 0 : Math.round((occupiedRooms / bookableRooms) * 1000) / 10,
    },
    arrivalsToday,
    departuresToday,
    recentBookings: recentBookings.map((booking) => toBookingDto(booking)),
  };
}

export interface PaginatedAdminBookings {
  data: BookingDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function listAllBookings(
  query: AdminBookingsQuery,
): Promise<PaginatedAdminBookings> {
  const conditions: SQL[] = [];

  if (query.status) {
    conditions.push(eq(bookings.status, query.status));
  }
  if (query.hotelSlug) {
    const hotelRooms = db
      .select({ id: rooms.id })
      .from(rooms)
      .innerJoin(hotels, eq(rooms.hotelId, hotels.id))
      .where(eq(hotels.slug, query.hotelSlug));
    conditions.push(inArray(bookings.roomId, hotelRooms));
  }
  if (query.from) {
    conditions.push(gte(bookings.checkIn, query.from));
  }
  if (query.to) {
    conditions.push(lte(bookings.checkIn, query.to));
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    const matchingGuest = exists(
      db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, bookings.userId),
            or(like(users.email, pattern), like(users.fullName, pattern)),
          ),
        ),
    );
    const anyMatch = or(like(bookings.reference, pattern), matchingGuest);
    if (anyMatch) {
      conditions.push(anyMatch);
    }
  }
  const where = and(...conditions);

  const total = db.select({ value: count() }).from(bookings).where(where).get()?.value ?? 0;
  const rows = db.query.bookings
    .findMany({
      where,
      orderBy: desc(bookings.createdAt),
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
      with: bookingWith,
    })
    .sync();

  return {
    data: rows.map((booking) => toBookingDto(booking)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function updateBookingStatus(
  bookingId: string,
  nextStatus: BookingStatus,
): Promise<BookingDto> {
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) {
    throw new NotFoundError(`No booking exists with id "${bookingId}"`);
  }

  const current = isBookingStatus(booking.status) ? booking.status : 'PENDING';
  const allowed = ADMIN_BOOKING_TRANSITIONS[current];

  if (!allowed.includes(nextStatus)) {
    throw new ConflictError(
      `A ${current} booking cannot move to ${nextStatus}`,
      { allowedTransitions: allowed },
    );
  }

  db.update(bookings)
    .set({
      status: nextStatus,
      cancelledAt: nextStatus === 'CANCELLED' ? new Date() : booking.cancelledAt,
    })
    .where(eq(bookings.id, bookingId))
    .run();

  const updated = db.query.bookings
    .findFirst({ where: eq(bookings.id, bookingId), with: bookingWith })
    .sync();
  if (!updated) {
    throw new NotFoundError(`No booking exists with id "${bookingId}"`);
  }

  logger.info({ bookingId, from: current, to: nextStatus }, 'Booking status changed by admin');
  return toBookingDto(updated);
}

export interface AdminRoomDto {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  hotel: { id: string; name: string; slug: string };
  roomType: { id: string; name: string; basePricePerNight: number };
  totalBookings: number;
}

const adminRoomWith = {
  hotel: { columns: { id: true, name: true, slug: true } },
  roomType: { columns: { id: true, name: true, basePricePerNight: true } },
} as const;

interface AdminRoomRow {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  hotel: { id: string; name: string; slug: string };
  roomType: { id: string; name: string; basePricePerNight: string };
}

function bookingCounts(roomIds: string[]): Map<string, number> {
  if (roomIds.length === 0) {
    return new Map();
  }
  return new Map(
    db
      .select({ roomId: bookings.roomId, count: count() })
      .from(bookings)
      .where(inArray(bookings.roomId, roomIds))
      .groupBy(bookings.roomId)
      .all()
      .map((row) => [row.roomId, row.count] as const),
  );
}

function toAdminRoomDto(room: AdminRoomRow, totalBookings: number): AdminRoomDto {
  return {
    id: room.id,
    roomNumber: room.roomNumber,
    floor: room.floor,
    status: room.status,
    hotel: room.hotel,
    roomType: {
      id: room.roomType.id,
      name: room.roomType.name,
      basePricePerNight: fromMinorUnits(toMinorUnits(room.roomType.basePricePerNight)),
    },
    totalBookings,
  };
}

function loadAdminRoom(roomId: string): AdminRoomDto {
  const room = db.query.rooms
    .findFirst({ where: eq(rooms.id, roomId), with: adminRoomWith })
    .sync();
  if (!room) {
    throw new NotFoundError(`No room exists with id "${roomId}"`);
  }
  return toAdminRoomDto(room, bookingCounts([room.id]).get(room.id) ?? 0);
}

export async function listRooms(query: AdminRoomsQuery): Promise<{
  data: AdminRoomDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const conditions: SQL[] = [];
  if (query.hotelSlug) {
    conditions.push(
      inArray(
        rooms.hotelId,
        db.select({ id: hotels.id }).from(hotels).where(eq(hotels.slug, query.hotelSlug)),
      ),
    );
  }
  if (query.status) {
    conditions.push(eq(rooms.status, query.status));
  }
  const where = and(...conditions);

  const total = db.select({ value: count() }).from(rooms).where(where).get()?.value ?? 0;
  const rows = db.query.rooms
    .findMany({
      where,
      orderBy: [asc(rooms.hotelId), asc(rooms.roomNumber)],
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
      with: adminRoomWith,
    })
    .sync();
  const counts = bookingCounts(rows.map((room) => room.id));

  return {
    data: rows.map((room) => toAdminRoomDto(room, counts.get(room.id) ?? 0)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function createRoom(input: CreateRoomInput): Promise<AdminRoomDto> {
  const roomType = db
    .select({ id: roomTypes.id, hotelId: roomTypes.hotelId })
    .from(roomTypes)
    .where(eq(roomTypes.id, input.roomTypeId))
    .get();

  if (!roomType) {
    throw new NotFoundError(`No room type exists with id "${input.roomTypeId}"`);
  }

  const duplicate = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.hotelId, roomType.hotelId), eq(rooms.roomNumber, input.roomNumber)))
    .get();
  if (duplicate) {
    throw new ConflictError(`Room ${input.roomNumber} already exists at this hotel`);
  }

  const created = db
    .insert(rooms)
    .values({
      hotelId: roomType.hotelId,
      roomTypeId: roomType.id,
      roomNumber: input.roomNumber,
      floor: input.floor,
      status: input.status,
    })
    .returning({ id: rooms.id })
    .get();

  logger.info({ roomId: created.id }, 'Room created by admin');
  return loadAdminRoom(created.id);
}

export async function updateRoom(roomId: string, input: UpdateRoomInput): Promise<AdminRoomDto> {
  const room = db.select().from(rooms).where(eq(rooms.id, roomId)).get();
  if (!room) {
    throw new NotFoundError(`No room exists with id "${roomId}"`);
  }

  if (input.roomTypeId && input.roomTypeId !== room.roomTypeId) {
    const roomType = db
      .select({ hotelId: roomTypes.hotelId })
      .from(roomTypes)
      .where(eq(roomTypes.id, input.roomTypeId))
      .get();
    if (!roomType || roomType.hotelId !== room.hotelId) {
      throw new ConflictError('A room can only be moved to a room type of the same hotel');
    }
  }

  if (input.status && input.status !== 'AVAILABLE') {
    const activeBookings =
      db
        .select({ value: count() })
        .from(bookings)
        .where(
          and(
            eq(bookings.roomId, roomId),
            inArray(bookings.status, ['PENDING', 'CONFIRMED', 'CHECKED_IN']),
            gte(bookings.checkOut, new Date()),
          ),
        )
        .get()?.value ?? 0;
    if (activeBookings > 0) {
      throw new ConflictError(
        `Room has ${activeBookings} upcoming booking(s); move or cancel them before taking it out of service`,
      );
    }
  }

  const changes: Partial<typeof rooms.$inferInsert> = {};
  if (input.roomNumber !== undefined) {
    changes.roomNumber = input.roomNumber;
  }
  if (input.floor !== undefined) {
    changes.floor = input.floor;
  }
  if (input.status !== undefined) {
    changes.status = input.status;
  }
  if (input.roomTypeId !== undefined) {
    changes.roomTypeId = input.roomTypeId;
  }

  if (Object.keys(changes).length > 0) {
    db.update(rooms).set(changes).where(eq(rooms.id, roomId)).run();
  }

  logger.info({ roomId }, 'Room updated by admin');
  return loadAdminRoom(roomId);
}

export async function deleteRoom(roomId: string): Promise<{ id: string; deleted: true }> {
  // bookings.room_id uses ON DELETE RESTRICT, so a room that has ever been
  // booked cannot be removed without destroying financial history. Taking it
  // out of service is the supported way to retire it.
  const bookingCount = bookingCounts([roomId]).get(roomId) ?? 0;

  if (bookingCount > 0) {
    throw new ConflictError(
      `Room has ${bookingCount} booking(s) on record; set its status to OUT_OF_SERVICE instead of deleting it`,
    );
  }

  const room = db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).get();
  if (!room) {
    throw new NotFoundError(`No room exists with id "${roomId}"`);
  }

  db.delete(rooms).where(eq(rooms.id, roomId)).run();
  logger.info({ roomId }, 'Room deleted by admin');
  return { id: roomId, deleted: true };
}
