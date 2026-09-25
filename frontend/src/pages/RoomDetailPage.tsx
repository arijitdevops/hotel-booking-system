import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { getRoom } from '../api/rooms';
import { ErrorBanner } from '../components/ErrorBanner';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { defaultCriteria } from '../components/SearchBar';
import { Spinner } from '../components/Spinner';
import { StarRating } from '../components/StarRating';
import { Thumbnail } from '../components/Thumbnail';
import { formatCurrency, formatDate } from '../lib/format';

export function RoomDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fallback = defaultCriteria();

  const checkIn = searchParams.get('checkIn') ?? fallback.checkIn;
  const checkOut = searchParams.get('checkOut') ?? fallback.checkOut;
  const guests = Number(searchParams.get('guests') ?? fallback.guests);
  const stayQuery = `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;

  const roomQuery = useQuery({
    queryKey: ['room', id, { checkIn, checkOut }],
    queryFn: () => getRoom(id, { checkIn, checkOut }),
    enabled: id.length > 0,
  });

  if (roomQuery.isPending) {
    return <Spinner label="Loading room" />;
  }

  if (roomQuery.isError || !roomQuery.data) {
    return (
      <div className="page page--narrow">
        <ErrorBanner error={roomQuery.error} onRetry={() => void roomQuery.refetch()} />
      </div>
    );
  }

  const { room } = roomQuery.data;

  return (
    <div className="page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link className="link" to={`/hotels/${room.hotel.slug}${stayQuery}`}>
          {room.hotel.name}
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{room.roomType.name}</span>
      </nav>

      <section className="room-detail">
        <div className="room-detail__main">
          <Thumbnail
            src={room.roomType.imageUrl}
            alt={room.roomType.name}
            className="room-detail__image"
          />

          <h1 className="page__title">{room.roomType.name}</h1>
          <p className="muted">
            Room {room.roomNumber}, floor {room.floor} &middot; {room.hotel.name},{' '}
            {room.hotel.city}
          </p>
          <StarRating value={room.hotel.starRating} size="medium" />

          <p>{room.roomType.description}</p>

          <h2 className="section__title">What is in the room</h2>
          <ul className="chip-list">
            <li className="chip">{room.roomType.bedConfiguration}</li>
            <li className="chip">Sleeps {room.roomType.maxOccupancy}</li>
            <li className="chip">{room.roomType.sizeSqm} m&sup2;</li>
            {room.roomType.amenities.map((amenity) => (
              <li key={amenity} className="chip">
                {amenity}
              </li>
            ))}
          </ul>

          <h2 className="section__title">House rules</h2>
          <ul className="list">
            <li>Check-in from {room.hotel.checkInTime}</li>
            <li>Check-out by {room.hotel.checkOutTime}</li>
            <li>Free cancellation until 48 hours before arrival</li>
          </ul>
        </div>

        <aside className="room-detail__aside card">
          <h2 className="card__title">Your stay</h2>
          <p className="muted">
            {formatDate(checkIn)} to {formatDate(checkOut)} &middot; {guests} guests
          </p>

          {room.quote ? (
            <PriceBreakdown quote={room.quote} />
          ) : (
            <p className="muted">Select dates to see a price.</p>
          )}

          {room.isAvailable === false ? (
            <p className="banner banner--warning">
              This room is not available for those dates. Try different dates or another room.
            </p>
          ) : (
            <Link className="button button--primary button--block" to={`/checkout/${room.id}${stayQuery}`}>
              Continue to checkout
            </Link>
          )}

          <p className="muted room-detail__base">
            Base rate {formatCurrency(room.roomType.basePricePerNight)} per night before seasonal
            adjustments.
          </p>
        </aside>
      </section>
    </div>
  );
}
