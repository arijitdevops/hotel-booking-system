import type { JSX } from 'react';
import { Link } from 'react-router-dom';

import { formatCurrency, pluralise } from '../lib/format';
import type { RoomTypeAvailability } from '../types';
import { StarRating } from './StarRating';
import { Thumbnail } from './Thumbnail';

interface RoomCardProps {
  result: RoomTypeAvailability;
  checkIn: string;
  checkOut: string;
  guests: number;
}

export function RoomCard({ result, checkIn, checkOut, guests }: RoomCardProps): JSX.Element {
  const { hotel, roomType, quote } = result;
  const stayQuery = `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;

  return (
    <article className="card room-card">
      <Thumbnail src={roomType.imageUrl} alt={roomType.name} className="room-card__image" />

      <div className="room-card__body">
        <header className="room-card__header">
          <div>
            <h3 className="room-card__title">{roomType.name}</h3>
            <p className="room-card__hotel">
              <Link to={`/hotels/${hotel.slug}${stayQuery}`}>{hotel.name}</Link> &middot;{' '}
              {hotel.city}, {hotel.country}
            </p>
          </div>
          <StarRating value={hotel.starRating} />
        </header>

        <p className="room-card__description">{roomType.description}</p>

        <ul className="chip-list">
          <li className="chip">{roomType.bedConfiguration}</li>
          <li className="chip">Sleeps {roomType.maxOccupancy}</li>
          <li className="chip">{roomType.sizeSqm} m&sup2;</li>
          {roomType.amenities.slice(0, 3).map((amenity) => (
            <li key={amenity} className="chip">
              {amenity}
            </li>
          ))}
        </ul>
      </div>

      <aside className="room-card__pricing">
        <p className="room-card__rate">
          <strong>{formatCurrency(quote.averageNightlyRate)}</strong>
          <span className="muted"> / night avg</span>
        </p>
        <p className="room-card__total">
          {formatCurrency(quote.total)} total for {pluralise(quote.nightCount, 'night')}
        </p>
        <p className="room-card__availability muted">
          {pluralise(result.availableRoomCount, 'room')} left
        </p>
        <Link className="button button--primary" to={`/rooms/${result.roomId}${stayQuery}`}>
          View room
        </Link>
        <Link className="button button--ghost" to={`/checkout/${result.roomId}${stayQuery}`}>
          Book now
        </Link>
      </aside>
    </article>
  );
}
