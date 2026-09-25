/**
 * Database schema (Drizzle ORM, SQLite dialect).
 *
 * SQLite has no enum or decimal types, so:
 *  - every "enum" column is TEXT whose allowed values live in src/domain/enums.ts
 *    and are enforced by the zod request schemas;
 *  - money columns use NUMERIC affinity and are read back as strings, which the
 *    services immediately convert to integer minor units (src/utils/money.ts);
 *  - timestamps are stored as integer milliseconds and surface as `Date`.
 *
 * After changing this file run `npm run db:generate` to write a new SQL
 * migration into backend/drizzle/, then `npm run db:migrate` to apply it.
 */
import { randomUUID } from 'node:crypto';

import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  numeric,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID());

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
    .$onUpdate(() => new Date()),
};

/** Application user. `role` is one of: GUEST | ADMIN. */
export const users = sqliteTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    role: text('role').notNull().default('GUEST'),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_key').on(t.email), index('users_role_idx').on(t.role)],
);

/** A bookable property. `amenities` is a JSON-encoded string array. */
export const hotels = sqliteTable(
  'hotels',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    addressLine: text('address_line').notNull(),
    city: text('city').notNull(),
    country: text('country').notNull(),
    starRating: integer('star_rating').notNull().default(3),
    amenities: text('amenities').notNull().default('[]'),
    checkInTime: text('check_in_time').notNull().default('15:00'),
    checkOutTime: text('check_out_time').notNull().default('11:00'),
    imageUrl: text('image_url'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('hotels_slug_key').on(t.slug),
    index('hotels_city_idx').on(t.city),
    index('hotels_country_city_idx').on(t.country, t.city),
  ],
);

/** A category of room within a hotel (Deluxe King, Family Suite, ...). */
export const roomTypes = sqliteTable(
  'room_types',
  {
    id: id(),
    hotelId: text('hotel_id')
      .notNull()
      .references(() => hotels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    /** Nightly rack rate in the property currency. */
    basePricePerNight: numeric('base_price_per_night').notNull(),
    maxOccupancy: integer('max_occupancy').notNull(),
    bedConfiguration: text('bed_configuration').notNull(),
    sizeSqm: integer('size_sqm').notNull(),
    amenities: text('amenities').notNull().default('[]'),
    imageUrl: text('image_url'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('room_types_hotel_id_name_key').on(t.hotelId, t.name),
    index('room_types_hotel_id_idx').on(t.hotelId),
  ],
);

/** A physical room. `status` is one of: AVAILABLE | MAINTENANCE | OUT_OF_SERVICE. */
export const rooms = sqliteTable(
  'rooms',
  {
    id: id(),
    hotelId: text('hotel_id')
      .notNull()
      .references(() => hotels.id, { onDelete: 'cascade' }),
    roomTypeId: text('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    roomNumber: text('room_number').notNull(),
    floor: integer('floor').notNull().default(1),
    status: text('status').notNull().default('AVAILABLE'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('rooms_hotel_id_room_number_key').on(t.hotelId, t.roomNumber),
    index('rooms_room_type_id_idx').on(t.roomTypeId),
    index('rooms_status_idx').on(t.status),
  ],
);

/**
 * Seasonal pricing window. `priceMultiplier` scales the room type base rate
 * for every night that falls inside [startDate, endDate).
 */
export const ratePlans = sqliteTable(
  'rate_plans',
  {
    id: id(),
    roomTypeId: text('room_type_id')
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: integer('start_date', { mode: 'timestamp_ms' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp_ms' }).notNull(),
    priceMultiplier: real('price_multiplier').notNull().default(1),
    ...timestamps,
  },
  (t) => [
    index('rate_plans_room_type_window_idx').on(t.roomTypeId, t.startDate, t.endDate),
    index('rate_plans_start_date_idx').on(t.startDate),
    index('rate_plans_end_date_idx').on(t.endDate),
  ],
);

/**
 * A stay reservation. The stay covers the half-open interval [checkIn, checkOut).
 * `status` is one of: PENDING | CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED.
 */
export const bookings = sqliteTable(
  'bookings',
  {
    id: id(),
    reference: text('reference').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'restrict' }),
    checkIn: integer('check_in', { mode: 'timestamp_ms' }).notNull(),
    checkOut: integer('check_out', { mode: 'timestamp_ms' }).notNull(),
    guests: integer('guests').notNull(),
    nights: integer('nights').notNull(),
    /** Gross amount payable including tax. */
    totalAmount: numeric('total_amount').notNull(),
    /** Tax portion of totalAmount, kept for invoicing. */
    taxAmount: numeric('tax_amount').notNull().default('0'),
    status: text('status').notNull().default('PENDING'),
    specialRequests: text('special_requests'),
    /** Fee charged when the booking was cancelled outside the free window. */
    cancellationFee: numeric('cancellation_fee').notNull().default('0'),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('bookings_reference_key').on(t.reference),
    index('bookings_room_stay_idx').on(t.roomId, t.checkIn, t.checkOut),
    index('bookings_check_in_idx').on(t.checkIn),
    index('bookings_check_out_idx').on(t.checkOut),
    index('bookings_status_idx').on(t.status),
    index('bookings_user_created_idx').on(t.userId, t.createdAt),
  ],
);

/**
 * Simulated payment record. `status` is one of: PENDING | PAID | FAILED | REFUNDED.
 * `method` is one of: CARD | PAYPAL | BANK_TRANSFER.
 */
export const payments = sqliteTable(
  'payments',
  {
    id: id(),
    bookingId: text('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    amount: numeric('amount').notNull(),
    method: text('method').notNull(),
    status: text('status').notNull().default('PENDING'),
    transactionRef: text('transaction_ref').notNull(),
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('payments_booking_id_key').on(t.bookingId),
    uniqueIndex('payments_transaction_ref_key').on(t.transactionRef),
    index('payments_status_idx').on(t.status),
  ],
);

/** Guest review, one per completed booking. */
export const reviews = sqliteTable(
  'reviews',
  {
    id: id(),
    bookingId: text('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    hotelId: text('hotel_id')
      .notNull()
      .references(() => hotels.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    title: text('title').notNull(),
    comment: text('comment').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('reviews_booking_id_key').on(t.bookingId),
    index('reviews_hotel_created_idx').on(t.hotelId, t.createdAt),
    index('reviews_user_id_idx').on(t.userId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Relations (used by the relational query API: db.query.<table>.findMany)    */
/* ------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  reviews: many(reviews),
}));

export const hotelsRelations = relations(hotels, ({ many }) => ({
  roomTypes: many(roomTypes),
  rooms: many(rooms),
  reviews: many(reviews),
}));

export const roomTypesRelations = relations(roomTypes, ({ one, many }) => ({
  hotel: one(hotels, { fields: [roomTypes.hotelId], references: [hotels.id] }),
  rooms: many(rooms),
  ratePlans: many(ratePlans),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  hotel: one(hotels, { fields: [rooms.hotelId], references: [hotels.id] }),
  roomType: one(roomTypes, { fields: [rooms.roomTypeId], references: [roomTypes.id] }),
  bookings: many(bookings),
}));

export const ratePlansRelations = relations(ratePlans, ({ one }) => ({
  roomType: one(roomTypes, { fields: [ratePlans.roomTypeId], references: [roomTypes.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  room: one(rooms, { fields: [bookings.roomId], references: [rooms.id] }),
  payment: one(payments, { fields: [bookings.id], references: [payments.bookingId] }),
  review: one(reviews, { fields: [bookings.id], references: [reviews.bookingId] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
  hotel: one(hotels, { fields: [reviews.hotelId], references: [hotels.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Hotel = typeof hotels.$inferSelect;
export type RoomType = typeof roomTypes.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type RatePlan = typeof ratePlans.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Review = typeof reviews.$inferSelect;
