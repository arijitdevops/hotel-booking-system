import type { JSX } from 'react';
import { Link } from 'react-router-dom';

import { formatCurrency, pluralise } from '../lib/format';
import type { HotelSummary } from '../types';
import { StarRating } from './StarRating';
import { Thumbnail } from './Thumbnail';

interface HotelCardProps {
  hotel: HotelSummary;
  stay?: { checkIn: string; checkOut: string; guests: number };
}

export function HotelCard({ hotel, stay }: HotelCardProps): JSX.Element {
  const search = stay
    ? `?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=${stay.guests}`
    : '';

  return (
    <article className="card hotel-card">
      <Thumbnail src={hotel.imageUrl} alt={hotel.name} className="hotel-card__image" />

      <div className="hotel-card__body">
        <header className="hotel-card__header">
          <div>
            <h3 className="hotel-card__title">
              <Link to={`/hotels/${hotel.slug}${search}`}>{hotel.name}</Link>
            </h3>
            <p className="hotel-card__location">
              {hotel.city}, {hotel.country}
            </p>
          </div>
          <StarRating value={hotel.starRating} />
        </header>

        <p className="hotel-card__description">{hotel.description}</p>

        <ul className="chip-list">
          {hotel.amenities.slice(0, 4).map((amenity) => (
            <li key={amenity} className="chip">
              {amenity}
            </li>
          ))}
        </ul>

        <footer className="hotel-card__footer">
          <div className="hotel-card__rating">
            {hotel.averageRating === null ? (
              <span className="muted">No reviews yet</span>
            ) : (
              <>
                <strong>{hotel.averageRating.toFixed(1)}</strong>{' '}
                <span className="muted">({pluralise(hotel.reviewCount, 'review')})</span>
              </>
            )}
          </div>
          <div className="hotel-card__price">
            {hotel.fromPricePerNight === null ? (
              <span className="muted">Rates on request</span>
            ) : (
              <>
                <span className="muted">from</span>{' '}
                <strong>{formatCurrency(hotel.fromPricePerNight)}</strong>{' '}
                <span className="muted">/ night</span>
              </>
            )}
          </div>
        </footer>
      </div>
    </article>
  );
}
