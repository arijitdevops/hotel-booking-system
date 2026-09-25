import { asc, avg, count, desc, eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { bookings, hotels, reviews } from '../../db/schema';
import { ConflictError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import type { AuthenticatedUser } from '../../middleware/auth';
import type { CreateReviewInput, HotelReviewsQuery } from './reviews.schema';

export interface ReviewDto {
  id: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  author: { id: string; fullName: string };
  stay: { reference: string; checkIn: string; checkOut: string; roomTypeName: string };
}

export interface ReviewSummary {
  average: number | null;
  count: number;
  /** Count per star rating, 1 through 5. */
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface PaginatedReviews {
  data: ReviewDto[];
  summary: ReviewSummary;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ReviewRow {
  id: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: Date;
  user: { id: string; fullName: string };
  booking: {
    reference: string;
    checkIn: Date;
    checkOut: Date;
    room: { roomType: { name: string } };
  };
}

function toReviewDto(review: ReviewRow): ReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    author: { id: review.user.id, fullName: review.user.fullName },
    stay: {
      reference: review.booking.reference,
      checkIn: review.booking.checkIn.toISOString().slice(0, 10),
      checkOut: review.booking.checkOut.toISOString().slice(0, 10),
      roomTypeName: review.booking.room.roomType.name,
    },
  };
}

const reviewWith = {
  user: { columns: { id: true, fullName: true } },
  booking: {
    columns: { reference: true, checkIn: true, checkOut: true },
    with: { room: { columns: {}, with: { roomType: { columns: { name: true } } } } },
  },
} as const;

function summarise(hotelId: string): ReviewSummary {
  const aggregate = db
    .select({ average: avg(reviews.rating), count: count() })
    .from(reviews)
    .where(eq(reviews.hotelId, hotelId))
    .get();
  const grouped = db
    .select({ rating: reviews.rating, count: count() })
    .from(reviews)
    .where(eq(reviews.hotelId, hotelId))
    .groupBy(reviews.rating)
    .all();

  const distribution: ReviewSummary['distribution'] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const row of grouped) {
    const key = String(row.rating);
    if (key === '1' || key === '2' || key === '3' || key === '4' || key === '5') {
      distribution[key] = row.count;
    }
  }

  const average = aggregate?.average ?? null;
  return {
    average: average === null ? null : Math.round(Number(average) * 10) / 10,
    count: aggregate?.count ?? 0,
    distribution,
  };
}

export async function listHotelReviews(
  slug: string,
  query: HotelReviewsQuery,
): Promise<PaginatedReviews> {
  const hotel = db.select({ id: hotels.id }).from(hotels).where(eq(hotels.slug, slug)).get();
  if (!hotel) {
    throw new NotFoundError(`No hotel exists with slug "${slug}"`);
  }

  const orderBy =
    query.sort === 'highest'
      ? [desc(reviews.rating), desc(reviews.createdAt)]
      : query.sort === 'lowest'
        ? [asc(reviews.rating), desc(reviews.createdAt)]
        : [desc(reviews.createdAt)];

  const summary = summarise(hotel.id);
  const rows = db.query.reviews
    .findMany({
      where: eq(reviews.hotelId, hotel.id),
      orderBy,
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
      with: reviewWith,
    })
    .sync();

  return {
    data: rows.map(toReviewDto),
    summary,
    page: query.page,
    pageSize: query.pageSize,
    total: summary.count,
    totalPages: Math.max(1, Math.ceil(summary.count / query.pageSize)),
  };
}

export async function createReview(
  user: AuthenticatedUser,
  input: CreateReviewInput,
): Promise<ReviewDto> {
  const booking = db.query.bookings
    .findFirst({
      where: eq(bookings.reference, input.bookingReference),
      with: { room: { columns: { hotelId: true } }, review: true },
    })
    .sync();

  if (!booking) {
    throw new NotFoundError(`No booking exists with reference ${input.bookingReference}`);
  }
  if (booking.userId !== user.id) {
    throw new ForbiddenError('You can only review your own stays');
  }
  if (booking.status === 'CANCELLED') {
    throw new ConflictError('A cancelled booking cannot be reviewed');
  }
  if (booking.checkOut.getTime() > Date.now()) {
    throw new ConflictError('You can review a stay once it is finished');
  }
  if (booking.review) {
    throw new ConflictError('This stay has already been reviewed');
  }

  const inserted = db
    .insert(reviews)
    .values({
      bookingId: booking.id,
      hotelId: booking.room.hotelId,
      userId: user.id,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
    })
    .returning({ id: reviews.id })
    .get();

  const created = db.query.reviews
    .findFirst({ where: eq(reviews.id, inserted.id), with: reviewWith })
    .sync();
  if (!created) {
    throw new NotFoundError('Review not found after insert');
  }

  return toReviewDto(created);
}

/** Reviews written by one guest, used by the account area. */
export async function listMyReviews(userId: string): Promise<ReviewDto[]> {
  const rows = db.query.reviews
    .findMany({ where: eq(reviews.userId, userId), orderBy: desc(reviews.createdAt), with: reviewWith })
    .sync();
  return rows.map(toReviewDto);
}
