import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { getHotel } from '../api/hotels';
import { listHotelReviews } from '../api/reviews';
import { searchRooms } from '../api/rooms';
import { ErrorBanner } from '../components/ErrorBanner';
import { ReviewList } from '../components/ReviewList';
import { Spinner } from '../components/Spinner';
import { StarRating } from '../components/StarRating';
import { Thumbnail } from '../components/Thumbnail';
import { defaultCriteria } from '../components/SearchBar';
import { formatCurrency, pluralise } from '../lib/format';

export function HotelDetailPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const fallback = defaultCriteria();

  const checkIn = searchParams.get('checkIn') ?? fallback.checkIn;
  const checkOut = searchParams.get('checkOut') ?? fallback.checkOut;
  const guests = Number(searchParams.get('guests') ?? fallback.guests);
  const stayQuery = `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;

  const hotelQuery = useQuery({
    queryKey: ['hotel', slug],
    queryFn: () => getHotel(slug),
    enabled: slug.length > 0,
  });

  const availabilityQuery = useQuery({
    queryKey: ['hotel', slug, 'availability', { checkIn, checkOut, guests }],
    queryFn: () => searchRooms({ hotelSlug: slug, checkIn, checkOut, guests }),
    enabled: slug.length > 0,
  });

  const reviewsQuery = useQuery({
    queryKey: ['hotel', slug, 'reviews'],
    queryFn: () => listHotelReviews(slug, { pageSize: 10 }),
    enabled: slug.length > 0,
  });

  if (hotelQuery.isPending) {
    return <Spinner label="Loading hotel" />;
  }

  if (hotelQuery.isError || !hotelQuery.data) {
    return (
      <div className="page page--narrow">
        <ErrorBanner error={hotelQuery.error} onRetry={() => void hotelQuery.refetch()} />
      </div>
    );
  }

  const hotel = hotelQuery.data.hotel;
  const availableByRoomType = new Map(
    (availabilityQuery.data?.results ?? []).map((result) => [result.roomType.id, result]),
  );

  return (
    <div className="page">
      <section className="hotel-hero">
        <Thumbnail src={hotel.imageUrl} alt={hotel.name} className="hotel-hero__image" />
        <div className="hotel-hero__body">
          <h1 className="page__title">{hotel.name}</h1>
          <StarRating value={hotel.starRating} showValue={false} size="medium" />
          <p className="muted">
            {hotel.addressLine}, {hotel.city}, {hotel.country}
          </p>
          <p>{hotel.description}</p>
          <ul className="chip-list">
            {hotel.amenities.map((amenity) => (
              <li key={amenity} className="chip">
                {amenity}
              </li>
            ))}
          </ul>
          <p className="muted">
            Check-in from {hotel.checkInTime} &middot; check-out by {hotel.checkOutTime}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section__header">
          <h2 className="section__title">Rooms</h2>
          <Link className="link" to={`/search?city=${encodeURIComponent(hotel.city)}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`}>
            Change dates
          </Link>
        </div>

        {availabilityQuery.isError && <ErrorBanner error={availabilityQuery.error} />}

        <div className="stack">
          {hotel.roomTypes.map((roomType) => {
            const availability = availableByRoomType.get(roomType.id);
            return (
              <article key={roomType.id} className="card room-type">
                <Thumbnail
                  src={roomType.imageUrl}
                  alt={roomType.name}
                  className="room-type__image"
                />
                <div className="room-type__body">
                  <h3 className="room-type__title">{roomType.name}</h3>
                  <p>{roomType.description}</p>
                  <ul className="chip-list">
                    <li className="chip">{roomType.bedConfiguration}</li>
                    <li className="chip">Sleeps {roomType.maxOccupancy}</li>
                    <li className="chip">{roomType.sizeSqm} m&sup2;</li>
                    {roomType.amenities.map((amenity) => (
                      <li key={amenity} className="chip">
                        {amenity}
                      </li>
                    ))}
                  </ul>
                </div>
                <aside className="room-type__pricing">
                  <p className="room-type__rate">
                    <strong>{formatCurrency(roomType.basePricePerNight)}</strong>
                    <span className="muted"> / night base rate</span>
                  </p>
                  {availabilityQuery.isPending ? (
                    <Spinner label="Checking availability" inline />
                  ) : availability ? (
                    <>
                      <p className="muted">
                        {formatCurrency(availability.quote.total)} total for{' '}
                        {pluralise(availability.quote.nightCount, 'night')}
                      </p>
                      <p className="muted">
                        {pluralise(availability.availableRoomCount, 'room')} available
                      </p>
                      <Link
                        className="button button--primary"
                        to={`/checkout/${availability.roomId}${stayQuery}`}
                      >
                        Book this room
                      </Link>
                    </>
                  ) : (
                    <p className="muted">Not available for the selected dates.</p>
                  )}
                </aside>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Guest reviews</h2>
        {reviewsQuery.isPending && <Spinner label="Loading reviews" />}
        {reviewsQuery.isError && <ErrorBanner error={reviewsQuery.error} />}
        {reviewsQuery.data && (
          <ReviewList reviews={reviewsQuery.data.data} summary={reviewsQuery.data.summary} />
        )}
      </section>
    </div>
  );
}
