/**
 * End to end happy path: register, sign in, search, book, pay, cancel, admin.
 *
 * The suite runs against an in-memory SQLite database (DATABASE_FILE=:memory:)
 * that is migrated from backend/drizzle before the first test, so it never
 * touches the development database file.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Express } from 'express';

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_FILE'] = ':memory:';
process.env['JWT_SECRET'] = 'integration-test-secret-value-32-chars';
process.env['JWT_EXPIRES_IN'] = '1h';
process.env['BCRYPT_ROUNDS'] = '4';
process.env['TAX_PERCENT'] = '10';
process.env['FREE_CANCELLATION_HOURS'] = '48';
process.env['CANCELLATION_FEE_PERCENT'] = '25';
process.env['LOG_LEVEL'] = 'silent';

let app: Express;
let closeDatabase: () => Promise<void>;

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  const iso = date.toISOString();
  return iso.slice(0, 10);
}

const CHECK_IN = isoDate(30);
const CHECK_OUT = isoDate(33);

interface AuthBody {
  token: string;
  user: { id: string; email: string; role: string };
}

async function seedFixtures(): Promise<void> {
  const { db } = await import('../../src/db/client');
  const { hotels, roomTypes, rooms, users } = await import('../../src/db/schema');
  const { hashPassword } = await import('../../src/utils/password');

  db.insert(hotels)
    .values({
      id: 'hotel-test',
      name: 'Test Harbour Hotel',
      slug: 'test-harbour-hotel',
      description: 'A fixture hotel used by the integration suite.',
      addressLine: '1 Test Quay',
      city: 'Testville',
      country: 'Testland',
      starRating: 4,
      amenities: JSON.stringify(['Free WiFi', 'Breakfast']),
    })
    .run();

  db.insert(roomTypes)
    .values({
      id: 'roomtype-test',
      hotelId: 'hotel-test',
      name: 'Standard Double',
      description: 'A fixture room type.',
      basePricePerNight: '100.00',
      maxOccupancy: 2,
      bedConfiguration: '1 double bed',
      sizeSqm: 24,
      amenities: JSON.stringify(['Desk']),
    })
    .run();

  db.insert(rooms)
    .values({
      id: 'room-test-1',
      hotelId: 'hotel-test',
      roomTypeId: 'roomtype-test',
      roomNumber: '101',
      floor: 1,
      status: 'AVAILABLE',
    })
    .run();

  db.insert(users)
    .values({
      id: 'user-test-admin',
      email: 'admin@test.local',
      passwordHash: await hashPassword('Admin@123'),
      fullName: 'Test Administrator',
      role: 'ADMIN',
    })
    .run();
}

beforeAll(async () => {
  const client = await import('../../src/db/client');
  client.runMigrations();
  closeDatabase = client.disconnectDatabase;

  ({ app } = await import('../../src/app'));

  await seedFixtures();
}, 60_000);

afterAll(async () => {
  if (closeDatabase) {
    await closeDatabase();
  }
});

describe('GET /api/health', () => {
  it('reports that the API is up', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', environment: 'test' });
  });
});

describe('authentication', () => {
  it('rejects a weak password at registration', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@test.local', password: 'short', fullName: 'Weak Password' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('registers, signs in and returns the profile', async () => {
    const registered = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'Guest@Test.local',
        password: 'Guest@123',
        fullName: 'Integration Guest',
        phone: '+44 131 555 0123',
      })
      .expect(201);

    const registerBody = registered.body as AuthBody;
    expect(registerBody.user.email).toBe('guest@test.local');
    expect(registerBody.user.role).toBe('GUEST');
    expect(registerBody.token).toBeTruthy();

    await request(app)
      .post('/api/auth/register')
      .send({ email: 'guest@test.local', password: 'Guest@123', fullName: 'Duplicate' })
      .expect(409);

    const loggedIn = await request(app)
      .post('/api/auth/login')
      .send({ email: 'guest@test.local', password: 'Guest@123' })
      .expect(200);

    const token = (loggedIn.body as AuthBody).token;

    await request(app).get('/api/auth/me').expect(401);

    const profile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.user.fullName).toBe('Integration Guest');
  });

  it('refuses a wrong password without revealing whether the account exists', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'guest@test.local', password: 'Wrong@123' })
      .expect(401);

    expect(response.body.error.message).toMatch(/incorrect/i);
  });
});

describe('booking a room end to end', () => {
  let guestToken = '';
  let secondGuestToken = '';
  let roomId = '';
  let reference = '';

  it('signs in the fixture guests', async () => {
    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: 'guest@test.local', password: 'Guest@123' })
      .expect(200);
    guestToken = (first.body as AuthBody).token;

    const second = await request(app)
      .post('/api/auth/register')
      .send({ email: 'rival@test.local', password: 'Rival@123', fullName: 'Rival Guest' })
      .expect(201);
    secondGuestToken = (second.body as AuthBody).token;
  });

  it('lists the hotel and finds an available room', async () => {
    const hotels = await request(app).get('/api/hotels').expect(200);
    expect(hotels.body.data).toHaveLength(1);
    expect(hotels.body.data[0].slug).toBe('test-harbour-hotel');

    const search = await request(app)
      .get('/api/rooms/search')
      .query({ city: 'Testville', checkIn: CHECK_IN, checkOut: CHECK_OUT, guests: 2 })
      .expect(200);

    expect(search.body.results).toHaveLength(1);
    const [result] = search.body.results;
    expect(result.availableRoomCount).toBe(1);
    expect(result.quote.nightCount).toBe(3);
    expect(result.quote.subtotal).toBe(300);
    expect(result.quote.tax).toBe(30);
    expect(result.quote.total).toBe(330);
    roomId = result.roomId;
  });

  it('rejects a stay with check-out before check-in', async () => {
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ roomId, checkIn: CHECK_OUT, checkOut: CHECK_IN, guests: 2 })
      .expect(422);
  });

  it('creates the booking', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ roomId, checkIn: CHECK_IN, checkOut: CHECK_OUT, guests: 2, specialRequests: 'High floor' })
      .expect(201);

    expect(response.body.booking.reference).toMatch(/^BK-\d{4}-\d{4,}$/);
    expect(response.body.booking.status).toBe('PENDING');
    expect(response.body.booking.totalAmount).toBe(330);
    expect(response.body.booking.nights).toBe(3);
    reference = response.body.booking.reference;
  });

  it('refuses to double-book the same room for overlapping dates', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${secondGuestToken}`)
      .send({ roomId, checkIn: CHECK_IN, checkOut: CHECK_OUT, guests: 1 })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('allows a back to back stay starting on the check-out day', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${secondGuestToken}`)
      .send({ roomId, checkIn: CHECK_OUT, checkOut: isoDate(35), guests: 1 })
      .expect(201);

    expect(response.body.booking.status).toBe('PENDING');
  });

  it('drops the room out of search results once it is taken', async () => {
    const search = await request(app)
      .get('/api/rooms/search')
      .query({ city: 'Testville', checkIn: CHECK_IN, checkOut: CHECK_OUT, guests: 2 })
      .expect(200);

    expect(search.body.results).toHaveLength(0);
  });

  it('keeps bookings private to their owner', async () => {
    await request(app)
      .get(`/api/bookings/${reference}`)
      .set('Authorization', `Bearer ${secondGuestToken}`)
      .expect(403);

    const own = await request(app)
      .get(`/api/bookings/${reference}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(own.body.booking.reference).toBe(reference);
  });

  it('takes a simulated payment and confirms the booking', async () => {
    const declined = await request(app)
      .post(`/api/payments/${reference}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        method: 'CARD',
        cardHolder: 'Integration Guest',
        // Luhn-valid but ends in 0000, which the simulator always declines.
        cardNumber: '4711111111110000',
        expiryMonth: 5,
        expiryYear: 2030,
        cvc: '123',
      })
      .expect(409);

    expect(declined.body.error.message).toMatch(/declined/i);

    const paid = await request(app)
      .post(`/api/payments/${reference}`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        method: 'CARD',
        cardHolder: 'Integration Guest',
        cardNumber: '4242424242424242',
        expiryMonth: 5,
        expiryYear: 2030,
        cvc: '123',
      })
      .expect(201);

    expect(paid.body.payment.status).toBe('PAID');
    expect(paid.body.booking.status).toBe('CONFIRMED');
  });

  it('lists the booking under the guest account', async () => {
    const response = await request(app)
      .get('/api/bookings/me')
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.data[0].reference).toBe(reference);
    expect(response.body.data[0].canCancel).toBe(true);
  });

  it('cancels free of charge outside the fee window', async () => {
    const response = await request(app)
      .post(`/api/bookings/${reference}/cancel`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ reason: 'Plans changed' })
      .expect(200);

    expect(response.body.booking.status).toBe('CANCELLED');
    expect(response.body.outcome.isFree).toBe(true);
    expect(response.body.outcome.feeAmount).toBe(0);
    expect(response.body.outcome.refundAmount).toBe(330);

    await request(app)
      .post(`/api/bookings/${reference}/cancel`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({})
      .expect(409);
  });

  it('frees the room again after cancellation', async () => {
    const search = await request(app)
      .get('/api/rooms/search')
      .query({ city: 'Testville', checkIn: CHECK_IN, checkOut: CHECK_OUT, guests: 2 })
      .expect(200);

    expect(search.body.results).toHaveLength(1);
  });
});

describe('admin area', () => {
  it('is closed to guests and open to administrators', async () => {
    const guest = await request(app)
      .post('/api/auth/login')
      .send({ email: 'guest@test.local', password: 'Guest@123' })
      .expect(200);

    await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${(guest.body as AuthBody).token}`)
      .expect(403);

    const admin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'Admin@123' })
      .expect(200);

    const stats = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${(admin.body as AuthBody).token}`)
      .expect(200);

    expect(stats.body.totals.hotels).toBe(1);
    expect(stats.body.totals.rooms).toBe(1);
    expect(stats.body.bookingsByStatus).toHaveProperty('CANCELLED');
  });
});

describe('unknown routes', () => {
  it('returns a structured 404', async () => {
    const response = await request(app).get('/api/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
