/**
 * Database seed.
 *
 * Deterministic: a fixed PRNG seed drives every random choice and every row is
 * written with an explicit primary key. The script first clears all tables, so
 * running it repeatedly always leaves exactly the same demo data behind (any
 * bookings you made through the UI are removed).
 *
 * Stay dates are generated relative to the day the seed runs so the demo always
 * has past, in-house and future bookings.
 */
import { env } from '../config/env';
import { isRoomAvailable, type BookingInterval } from '../modules/rooms/availability';
import { formatBookingReference } from '../utils/bookingReference';
import { evaluateCancellation } from '../utils/cancellation';
import { addDays, differenceInNights, todayUtc } from '../utils/dates';
import { formatMinorUnits, toMinorUnits } from '../utils/money';
import { hashPassword } from '../utils/password';
import { quoteStay, type RatePlanWindow } from '../utils/pricing';
import { db, disconnectDatabase, runMigrations } from './client';
import {
  bookings,
  hotels,
  payments,
  ratePlans,
  reviews,
  rooms as roomsTable,
  roomTypes,
  users,
} from './schema';

/** mulberry32 - small, fast, and identical on every platform. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260401);

function randomInt(minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(random() * (maxInclusive - minInclusive + 1));
}

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error('Cannot pick from an empty list');
  }
  return item;
}

const TODAY = todayUtc();

interface RoomTypeSeed {
  key: string;
  name: string;
  description: string;
  basePricePerNight: string;
  maxOccupancy: number;
  bedConfiguration: string;
  sizeSqm: number;
  amenities: string[];
  roomCount: number;
  floors: number[];
}

interface HotelSeed {
  key: string;
  name: string;
  slug: string;
  description: string;
  addressLine: string;
  city: string;
  country: string;
  starRating: number;
  amenities: string[];
  checkInTime: string;
  checkOutTime: string;
  roomTypes: RoomTypeSeed[];
}

const HOTELS: HotelSeed[] = [
  {
    key: 'h1',
    name: 'Azure Bay Resort',
    slug: 'azure-bay-resort',
    description:
      'A low-rise beachfront resort on the quieter side of the bay, built around three saltwater pools and a coconut grove. Every room faces the water.',
    addressLine: '14 Shoreline Drive',
    city: 'Lisbon',
    country: 'Portugal',
    starRating: 5,
    amenities: ['Beachfront', 'Outdoor pool', 'Spa', 'Free WiFi', 'Airport shuttle', 'Restaurant'],
    checkInTime: '15:00',
    checkOutTime: '11:00',
    roomTypes: [
      {
        key: 'rt1',
        name: 'Garden View Double',
        description: 'A calm 28 m² room opening onto the palm garden, with a walk-in shower.',
        basePricePerNight: '145.00',
        maxOccupancy: 2,
        bedConfiguration: '1 queen bed',
        sizeSqm: 28,
        amenities: ['Air conditioning', 'Rain shower', 'Nespresso machine', 'Safe'],
        roomCount: 12,
        floors: [1, 2],
      },
      {
        key: 'rt2',
        name: 'Ocean View King',
        description: 'Corner room with a full-width balcony over the bay and a deep soaking tub.',
        basePricePerNight: '219.00',
        maxOccupancy: 2,
        bedConfiguration: '1 king bed',
        sizeSqm: 36,
        amenities: ['Balcony', 'Sea view', 'Bathtub', 'Minibar', 'Air conditioning'],
        roomCount: 10,
        floors: [2, 3],
      },
      {
        key: 'rt3',
        name: 'Family Suite',
        description: 'Two connecting rooms, a lounge and a kitchenette for longer family stays.',
        basePricePerNight: '310.00',
        maxOccupancy: 5,
        bedConfiguration: '1 king bed and 2 single beds',
        sizeSqm: 62,
        amenities: ['Kitchenette', 'Two bathrooms', 'Sofa bed', 'Sea view', 'Balcony'],
        roomCount: 8,
        floors: [3],
      },
      {
        key: 'rt4',
        name: 'Beach Villa',
        description: 'Standalone villa with a plunge pool and direct sand access.',
        basePricePerNight: '495.00',
        maxOccupancy: 4,
        bedConfiguration: '2 king beds',
        sizeSqm: 95,
        amenities: ['Private pool', 'Terrace', 'Butler service', 'Outdoor shower'],
        roomCount: 8,
        floors: [1],
      },
    ],
  },
  {
    key: 'h2',
    name: 'The Northgate Hotel',
    slug: 'the-northgate-hotel',
    description:
      'A converted 1890s merchant house five minutes from the central station, with a courtyard bar and a library lounge.',
    addressLine: '2 Northgate Square',
    city: 'Edinburgh',
    country: 'United Kingdom',
    starRating: 4,
    amenities: ['Free WiFi', 'Bar', 'Breakfast buffet', 'Pet friendly', 'Fitness room'],
    checkInTime: '14:00',
    checkOutTime: '11:00',
    roomTypes: [
      {
        key: 'rt1',
        name: 'Classic Single',
        description: 'A compact room under the eaves, ideal for a short city stay.',
        basePricePerNight: '89.00',
        maxOccupancy: 1,
        bedConfiguration: '1 single bed',
        sizeSqm: 16,
        amenities: ['Desk', 'Free WiFi', 'Blackout curtains'],
        roomCount: 10,
        floors: [4],
      },
      {
        key: 'rt2',
        name: 'Heritage Double',
        description: 'Original cornicing, sash windows over the square and a roll-top bath.',
        basePricePerNight: '132.00',
        maxOccupancy: 2,
        bedConfiguration: '1 double bed',
        sizeSqm: 24,
        amenities: ['Bathtub', 'City view', 'Tea and coffee', 'Free WiFi'],
        roomCount: 14,
        floors: [1, 2, 3],
      },
      {
        key: 'rt3',
        name: 'Courtyard Twin',
        description: 'Quiet twin room facing the planted courtyard, away from the street.',
        basePricePerNight: '118.00',
        maxOccupancy: 2,
        bedConfiguration: '2 single beds',
        sizeSqm: 22,
        amenities: ['Courtyard view', 'Free WiFi', 'Work desk'],
        roomCount: 9,
        floors: [1, 2],
      },
    ],
  },
  {
    key: 'h3',
    name: 'Cedar Ridge Lodge',
    slug: 'cedar-ridge-lodge',
    description:
      'A timber lodge at 1,600 m with ski-in access in winter and a trailhead at the door in summer. Wood fires in every lounge.',
    addressLine: '77 Ridgeline Road',
    city: 'Innsbruck',
    country: 'Austria',
    starRating: 4,
    amenities: ['Ski storage', 'Sauna', 'Free parking', 'Restaurant', 'Free WiFi'],
    checkInTime: '16:00',
    checkOutTime: '10:00',
    roomTypes: [
      {
        key: 'rt1',
        name: 'Alpine Double',
        description: 'Pine-clad room with a small balcony facing the valley.',
        basePricePerNight: '156.00',
        maxOccupancy: 2,
        bedConfiguration: '1 queen bed',
        sizeSqm: 26,
        amenities: ['Balcony', 'Mountain view', 'Heated floor'],
        roomCount: 12,
        floors: [1, 2],
      },
      {
        key: 'rt2',
        name: 'Loft Suite',
        description: 'Split-level suite with a wood stove and a soaking tub under the skylight.',
        basePricePerNight: '268.00',
        maxOccupancy: 4,
        bedConfiguration: '1 king bed and 1 sofa bed',
        sizeSqm: 54,
        amenities: ['Wood stove', 'Bathtub', 'Skylight', 'Kitchenette'],
        roomCount: 8,
        floors: [3],
      },
      {
        key: 'rt3',
        name: 'Bunk Room',
        description: 'Four-bed room for groups, with a drying cupboard for ski gear.',
        basePricePerNight: '98.00',
        maxOccupancy: 4,
        bedConfiguration: '2 bunk beds',
        sizeSqm: 20,
        amenities: ['Drying cupboard', 'Shared lounge access', 'Lockers'],
        roomCount: 9,
        floors: [1],
      },
    ],
  },
  {
    key: 'h4',
    name: 'Harbourline Suites',
    slug: 'harbourline-suites',
    description:
      'Apartment-style suites in a restored grain warehouse on the harbour, each with a kitchen and laundry.',
    addressLine: '5 Quay Street',
    city: 'Rotterdam',
    country: 'Netherlands',
    starRating: 4,
    amenities: ['Kitchenette', 'Laundry', 'Bike hire', 'Free WiFi', 'Co-working space'],
    checkInTime: '15:00',
    checkOutTime: '11:00',
    roomTypes: [
      {
        key: 'rt1',
        name: 'Studio Suite',
        description: 'Open-plan studio with a full kitchen and harbour-facing windows.',
        basePricePerNight: '124.00',
        maxOccupancy: 2,
        bedConfiguration: '1 queen bed',
        sizeSqm: 32,
        amenities: ['Kitchen', 'Washer', 'Harbour view', 'Free WiFi'],
        roomCount: 15,
        floors: [2, 3, 4],
      },
      {
        key: 'rt2',
        name: 'One Bedroom Suite',
        description: 'Separate bedroom, living room and a dining table for four.',
        basePricePerNight: '178.00',
        maxOccupancy: 3,
        bedConfiguration: '1 king bed and 1 sofa bed',
        sizeSqm: 48,
        amenities: ['Kitchen', 'Washer', 'Dishwasher', 'Living room'],
        roomCount: 11,
        floors: [3, 4],
      },
      {
        key: 'rt3',
        name: 'Penthouse Loft',
        description: 'Top-floor loft with a roof terrace over the water.',
        basePricePerNight: '345.00',
        maxOccupancy: 4,
        bedConfiguration: '2 queen beds',
        sizeSqm: 78,
        amenities: ['Roof terrace', 'Kitchen', 'Sound system', 'Harbour view'],
        roomCount: 8,
        floors: [5],
      },
    ],
  },
  {
    key: 'h5',
    name: 'Old Town Courtyard Inn',
    slug: 'old-town-courtyard-inn',
    description:
      'A family-run inn inside the old town walls, arranged around a cobbled courtyard with a bakery on the ground floor.',
    addressLine: '18 Rynek Starego Miasta',
    city: 'Krakow',
    country: 'Poland',
    starRating: 3,
    amenities: ['Bakery', 'Free WiFi', 'Airport transfer', 'Luggage storage', 'Family rooms'],
    checkInTime: '14:00',
    checkOutTime: '10:00',
    roomTypes: [
      {
        key: 'rt1',
        name: 'Courtyard Double',
        description: 'Simple, quiet double overlooking the cobbled courtyard.',
        basePricePerNight: '72.00',
        maxOccupancy: 2,
        bedConfiguration: '1 double bed',
        sizeSqm: 20,
        amenities: ['Free WiFi', 'Courtyard view', 'Tea and coffee'],
        roomCount: 13,
        floors: [1, 2],
      },
      {
        key: 'rt2',
        name: 'Attic Family Room',
        description: 'Beamed attic room sleeping four, with a view over the rooftops.',
        basePricePerNight: '108.00',
        maxOccupancy: 4,
        bedConfiguration: '1 double bed and 2 single beds',
        sizeSqm: 34,
        amenities: ['Rooftop view', 'Family friendly', 'Free WiFi'],
        roomCount: 8,
        floors: [3],
      },
      {
        key: 'rt3',
        name: 'Market Square Twin',
        description: 'Front-facing twin room looking straight onto the market square.',
        basePricePerNight: '86.00',
        maxOccupancy: 2,
        bedConfiguration: '2 single beds',
        sizeSqm: 24,
        amenities: ['Square view', 'Free WiFi', 'Desk'],
        roomCount: 10,
        floors: [2],
      },
    ],
  },
];

interface RatePlanSeed {
  suffix: string;
  name: string;
  startOffsetDays: number;
  lengthDays: number;
  priceMultiplier: number;
}

/** Seasonal windows, expressed relative to today so they always apply. */
const RATE_PLANS: RatePlanSeed[] = [
  { suffix: 'early', name: 'Shoulder season', startOffsetDays: -60, lengthDays: 45, priceMultiplier: 0.85 },
  { suffix: 'peak', name: 'Peak season', startOffsetDays: 7, lengthDays: 28, priceMultiplier: 1.35 },
  { suffix: 'weekend', name: 'Long weekend', startOffsetDays: 45, lengthDays: 4, priceMultiplier: 1.2 },
  { suffix: 'late', name: 'Late availability', startOffsetDays: 70, lengthDays: 30, priceMultiplier: 0.9 },
];

interface UserSeed {
  id: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'GUEST' | 'ADMIN';
}

const USERS: UserSeed[] = [
  {
    id: 'user-admin',
    email: 'admin@example.com',
    password: 'Admin@123',
    fullName: 'Robin Alvarez',
    phone: '+351 21 555 0100',
    role: 'ADMIN',
  },
  {
    id: 'user-guest-1',
    email: 'guest@example.com',
    password: 'Guest@123',
    fullName: 'Marta Kowalski',
    phone: '+48 12 555 0142',
    role: 'GUEST',
  },
  {
    id: 'user-guest-2',
    email: 'liam@example.com',
    password: 'Guest@123',
    fullName: 'Liam O’Donnell',
    phone: '+44 131 555 0177',
    role: 'GUEST',
  },
  {
    id: 'user-guest-3',
    email: 'yuki@example.com',
    password: 'Guest@123',
    fullName: 'Yuki Tanaka',
    phone: '+31 10 555 0198',
    role: 'GUEST',
  },
];

const REVIEW_TITLES = [
  'Exactly what the photos promised',
  'Great location, friendly team',
  'Comfortable stay, would return',
  'Lovely room, breakfast was the highlight',
  'Quiet, clean and well run',
  'Good value for the area',
];

const REVIEW_COMMENTS = [
  'Check-in was quick, the room was spotless and the staff sorted a late checkout without any fuss. The bed was genuinely comfortable.',
  'We were placed away from the lift as requested. Everything worked, the shower was excellent and the area is easy to get around on foot.',
  'Second stay here and it was as good as the first. Breakfast has a proper selection and the coffee is good, which is rarer than it should be.',
  'The room was a little smaller than expected but immaculately kept, and the team could not have been more helpful with directions and bookings.',
  'Well priced for what you get. Quiet at night, strong WiFi, and the location meant we barely used public transport.',
  'Booking, arrival and departure were all painless. We had a small issue with the heating and someone fixed it within ten minutes.',
];

const SPECIAL_REQUESTS = [
  'High floor if possible, please.',
  'Travelling with a toddler - a cot would be appreciated.',
  'Late arrival, around 23:00.',
  'Quiet room away from the lift.',
  null,
  null,
];

interface SeededRoom {
  id: string;
  hotelId: string;
  roomTypeId: string;
  roomNumber: string;
  basePriceMinor: number;
  maxOccupancy: number;
  ratePlans: RatePlanWindow[];
}

function seedInventory(): SeededRoom[] {
  const seeded: SeededRoom[] = [];

  for (const hotel of HOTELS) {
    const hotelId = `hotel-${hotel.key}`;
    // Room numbers are <floor><two digit sequence>, unique across the hotel.
    const nextOnFloor = new Map<number, number>();

    db.insert(hotels)
      .values({
        id: hotelId,
        name: hotel.name,
        slug: hotel.slug,
        description: hotel.description,
        addressLine: hotel.addressLine,
        city: hotel.city,
        country: hotel.country,
        starRating: hotel.starRating,
        amenities: JSON.stringify(hotel.amenities),
        checkInTime: hotel.checkInTime,
        checkOutTime: hotel.checkOutTime,
        imageUrl: `/images/hotels/${hotel.slug}.jpg`,
      })
      .run();

    for (const roomType of hotel.roomTypes) {
      const roomTypeId = `rt-${hotel.key}-${roomType.key}`;

      db.insert(roomTypes)
        .values({
          id: roomTypeId,
          hotelId,
          name: roomType.name,
          description: roomType.description,
          basePricePerNight: roomType.basePricePerNight,
          maxOccupancy: roomType.maxOccupancy,
          bedConfiguration: roomType.bedConfiguration,
          sizeSqm: roomType.sizeSqm,
          amenities: JSON.stringify(roomType.amenities),
          imageUrl: `/images/rooms/${hotel.slug}-${roomType.key}.jpg`,
        })
        .run();

      const windows: RatePlanWindow[] = [];
      for (const plan of RATE_PLANS) {
        const startDate = addDays(TODAY, plan.startOffsetDays);
        const endDate = addDays(startDate, plan.lengthDays);

        db.insert(ratePlans)
          .values({
            id: `rp-${hotel.key}-${roomType.key}-${plan.suffix}`,
            roomTypeId,
            name: plan.name,
            startDate,
            endDate,
            priceMultiplier: plan.priceMultiplier,
          })
          .run();

        windows.push({ name: plan.name, startDate, endDate, priceMultiplier: plan.priceMultiplier });
      }

      for (let index = 0; index < roomType.roomCount; index += 1) {
        const floor = roomType.floors[index % roomType.floors.length] ?? 1;
        const sequence = (nextOnFloor.get(floor) ?? 0) + 1;
        nextOnFloor.set(floor, sequence);
        const roomNumber = `${floor}${String(sequence).padStart(2, '0')}`;
        const roomId = `room-${hotel.key}-${roomType.key}-${index + 1}`;
        // One room per larger type is parked in maintenance to exercise the filter.
        const status =
          index === roomType.roomCount - 1 && roomType.roomCount > 9 ? 'MAINTENANCE' : 'AVAILABLE';

        db.insert(roomsTable)
          .values({ id: roomId, hotelId, roomTypeId, roomNumber, floor, status })
          .run();

        if (status === 'AVAILABLE') {
          seeded.push({
            id: roomId,
            hotelId,
            roomTypeId,
            roomNumber,
            basePriceMinor: toMinorUnits(roomType.basePricePerNight),
            maxOccupancy: roomType.maxOccupancy,
            ratePlans: windows,
          });
        }
      }
    }
  }

  console.log(
    `Seeded ${HOTELS.length} hotels, ${HOTELS.reduce((sum, h) => sum + h.roomTypes.length, 0)} room types and ${seeded.length} bookable rooms`,
  );
  return seeded;
}

interface PlannedBooking {
  room: SeededRoom;
  userId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  specialRequests: string | null;
}

const TARGET_BOOKINGS = 30;

function planBookings(rooms: SeededRoom[]): PlannedBooking[] {
  const guests = USERS.filter((user) => user.role === 'GUEST');
  const intervalsByRoom = new Map<string, BookingInterval[]>();
  const planned: PlannedBooking[] = [];

  let attempts = 0;
  while (planned.length < TARGET_BOOKINGS && attempts < TARGET_BOOKINGS * 20) {
    attempts += 1;

    const room = pick(rooms);
    const guest = guests[planned.length % guests.length];
    if (!guest) {
      break;
    }

    const startOffset = randomInt(-120, 95);
    const nights = randomInt(1, 6);
    const checkIn = addDays(TODAY, startOffset);
    const checkOut = addDays(checkIn, nights);

    const existing = intervalsByRoom.get(room.id) ?? [];
    if (!isRoomAvailable(existing, checkIn, checkOut)) {
      continue;
    }

    let status: PlannedBooking['status'];
    if (checkOut.getTime() <= TODAY.getTime()) {
      status = 'CHECKED_OUT';
    } else if (checkIn.getTime() <= TODAY.getTime()) {
      status = 'CHECKED_IN';
    } else {
      status = planned.length % 7 === 0 ? 'PENDING' : 'CONFIRMED';
    }

    // A handful of cancellations, so the dashboard has every status in it.
    if (status !== 'CHECKED_IN' && planned.length % 9 === 4) {
      status = 'CANCELLED';
    }

    // Cancelled stays release the room, so they are not recorded as occupying.
    if (status !== 'CANCELLED') {
      existing.push({ checkIn, checkOut, status });
      intervalsByRoom.set(room.id, existing);
    }

    planned.push({
      room,
      userId: guest.id,
      checkIn,
      checkOut,
      guests: Math.min(room.maxOccupancy, randomInt(1, 3)),
      status,
      specialRequests: pick(SPECIAL_REQUESTS),
    });
  }

  return planned;
}

function seedBookings(bookable: SeededRoom[]): void {
  const planned = planBookings(bookable);
  const sequenceByYear = new Map<number, number>();
  let reviewCount = 0;
  let paymentCount = 0;

  for (let index = 0; index < planned.length; index += 1) {
    const booking = planned[index];
    if (!booking) {
      continue;
    }

    const year = booking.checkIn.getUTCFullYear();
    const sequence = (sequenceByYear.get(year) ?? 0) + 1;
    sequenceByYear.set(year, sequence);
    const reference = formatBookingReference(year, sequence);

    const quote = quoteStay({
      basePricePerNightMinor: booking.room.basePriceMinor,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      ratePlans: booking.room.ratePlans,
      taxPercent: env.TAX_PERCENT,
    });

    const bookingId = `booking-${String(index + 1).padStart(4, '0')}`;
    const createdAt = addDays(booking.checkIn, -randomInt(3, 45));
    // Cancelled two days out, which is inside the 48 hour free window only if
    // FREE_CANCELLATION_HOURS is left at its default - the policy decides.
    const cancelledAt = booking.status === 'CANCELLED' ? addDays(booking.checkIn, -2) : null;
    const cancellationOutcome = cancelledAt
      ? evaluateCancellation({
          totalMinor: quote.totalMinor,
          checkIn: booking.checkIn,
          now: cancelledAt,
          policy: {
            freeCancellationHours: env.FREE_CANCELLATION_HOURS,
            feePercent: env.CANCELLATION_FEE_PERCENT,
          },
        })
      : null;

    db.insert(bookings)
      .values({
        id: bookingId,
        reference,
        userId: booking.userId,
        roomId: booking.room.id,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: booking.guests,
        nights: differenceInNights(booking.checkIn, booking.checkOut),
        totalAmount: formatMinorUnits(quote.totalMinor),
        taxAmount: formatMinorUnits(quote.taxMinor),
        cancellationFee: formatMinorUnits(cancellationOutcome?.feeMinor ?? 0),
        status: booking.status,
        specialRequests: booking.specialRequests,
        createdAt,
        updatedAt: createdAt,
        cancelledAt,
      })
      .run();

    const isPaid =
      booking.status === 'CONFIRMED' ||
      booking.status === 'CHECKED_IN' ||
      booking.status === 'CHECKED_OUT';

    if (isPaid || booking.status === 'CANCELLED') {
      const settledMinor = isPaid
        ? quote.totalMinor
        : (cancellationOutcome?.refundMinor ?? quote.totalMinor);

      db.insert(payments)
        .values({
          id: `payment-${String(index + 1).padStart(4, '0')}`,
          bookingId,
          amount: formatMinorUnits(settledMinor),
          method: pick(['CARD', 'CARD', 'PAYPAL', 'BANK_TRANSFER'] as const),
          status: isPaid ? 'PAID' : 'REFUNDED',
          transactionRef: `TXN-SEED-${String(index + 1).padStart(6, '0')}`,
          paidAt: isPaid ? createdAt : null,
        })
        .run();
      paymentCount += 1;
    }

    // Completed stays get a review roughly two thirds of the time.
    if (booking.status === 'CHECKED_OUT' && index % 3 !== 0) {
      const reviewedAt = addDays(booking.checkOut, randomInt(1, 10));
      db.insert(reviews)
        .values({
          id: `review-${String(index + 1).padStart(4, '0')}`,
          bookingId,
          hotelId: booking.room.hotelId,
          userId: booking.userId,
          rating: randomInt(3, 5),
          title: pick(REVIEW_TITLES),
          comment: pick(REVIEW_COMMENTS),
          createdAt: reviewedAt,
          updatedAt: reviewedAt,
        })
        .run();
      reviewCount += 1;
    }
  }

  console.log(
    `Seeded ${planned.length} bookings, ${paymentCount} payments and ${reviewCount} reviews`,
  );
}

/** Children first, so foreign keys never block the wipe. */
function clearDatabase(): void {
  for (const table of [reviews, payments, bookings, ratePlans, roomsTable, roomTypes, hotels, users]) {
    db.delete(table).run();
  }
}

export async function seedDatabase(): Promise<void> {
  console.log('Seeding the hotel booking database...');
  runMigrations();

  // Password hashing is async, so it happens before the synchronous transaction.
  const hashed = await Promise.all(USERS.map((user) => hashPassword(user.password)));

  db.transaction(() => {
    clearDatabase();
    USERS.forEach((user, index) => {
      db.insert(users)
        .values({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          passwordHash: hashed[index] ?? '',
        })
        .run();
    });
    console.log(`Seeded ${USERS.length} users`);
    const bookable = seedInventory();
    seedBookings(bookable);
  });

  console.log('Seed complete.');
  console.log('  Admin:  admin@example.com / Admin@123');
  console.log('  Guest:  guest@example.com / Guest@123');
}

// Run directly (`npm run db:seed`), but stay importable from reset.ts.
if (require.main === module) {
  seedDatabase()
    .catch((error: unknown) => {
      console.error('Seeding failed:', error);
      process.exitCode = 1;
    })
    .finally(() => {
      void disconnectDatabase();
    });
}
