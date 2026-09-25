import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { listHotels } from '../api/hotels';
import { ErrorBanner } from '../components/ErrorBanner';
import { HotelCard } from '../components/HotelCard';
import { SearchBar, defaultCriteria, type SearchCriteria } from '../components/SearchBar';
import { Spinner } from '../components/Spinner';

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const criteria = defaultCriteria();

  const hotelsQuery = useQuery({
    queryKey: ['hotels', { pageSize: 6 }],
    queryFn: () => listHotels({ pageSize: 6 }),
  });

  function handleSearch(next: SearchCriteria): void {
    const params = new URLSearchParams({
      checkIn: next.checkIn,
      checkOut: next.checkOut,
      guests: String(next.guests),
    });
    if (next.city) {
      params.set('city', next.city);
    }
    navigate(`/search?${params.toString()}`);
  }

  return (
    <div className="page">
      <section className="hero">
        <div className="hero__content">
          <h1 className="hero__title">Rooms worth the trip</h1>
          <p className="hero__subtitle">
            Five independent properties, honest nightly pricing and free cancellation up to 48 hours
            before you arrive.
          </p>
        </div>
        <SearchBar initial={criteria} onSearch={handleSearch} />
      </section>

      <section className="section">
        <div className="section__header">
          <h2 className="section__title">Featured properties</h2>
          <Link className="link" to="/search">
            Browse all availability
          </Link>
        </div>

        {hotelsQuery.isPending && <Spinner label="Loading hotels" />}
        {hotelsQuery.isError && (
          <ErrorBanner error={hotelsQuery.error} onRetry={() => void hotelsQuery.refetch()} />
        )}

        <div className="grid grid--cards">
          {(hotelsQuery.data?.data ?? []).map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      </section>

      <section className="section section--split">
        <div className="info-card">
          <h3>Transparent nightly rates</h3>
          <p>
            Every quote lists what each night costs, including seasonal rate plans, before you are
            asked for a payment method.
          </p>
        </div>
        <div className="info-card">
          <h3>No double bookings</h3>
          <p>
            Availability is re-checked inside the same database transaction that writes your
            reservation, so a room cannot be sold twice.
          </p>
        </div>
        <div className="info-card">
          <h3>Cancel with confidence</h3>
          <p>
            Cancel free of charge until 48 hours before check-in. After that a clearly stated
            percentage fee applies.
          </p>
        </div>
      </section>
    </div>
  );
}
