import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { searchRooms } from '../api/rooms';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { RoomCard } from '../components/RoomCard';
import { SearchBar, defaultCriteria, type SearchCriteria } from '../components/SearchBar';
import { Spinner } from '../components/Spinner';
import { formatDate, pluralise } from '../lib/format';
import { searchSchema } from '../lib/validation';

export function SearchResultsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const fallback = defaultCriteria();

  const criteria: SearchCriteria = {
    city: searchParams.get('city') ?? '',
    checkIn: searchParams.get('checkIn') ?? fallback.checkIn,
    checkOut: searchParams.get('checkOut') ?? fallback.checkOut,
    guests: Number(searchParams.get('guests') ?? fallback.guests),
  };

  const parsed = searchSchema.safeParse(criteria);
  const isValid = parsed.success;

  const roomsQuery = useQuery({
    queryKey: ['rooms', 'search', criteria],
    queryFn: () =>
      searchRooms({
        ...(criteria.city ? { city: criteria.city } : {}),
        checkIn: criteria.checkIn,
        checkOut: criteria.checkOut,
        guests: criteria.guests,
      }),
    enabled: isValid,
  });

  function handleSearch(next: SearchCriteria): void {
    const params: Record<string, string> = {
      checkIn: next.checkIn,
      checkOut: next.checkOut,
      guests: String(next.guests),
    };
    if (next.city) {
      params['city'] = next.city;
    }
    setSearchParams(params);
  }

  const results = roomsQuery.data?.results ?? [];

  return (
    <div className="page">
      <section className="section">
        <h1 className="page__title">Available rooms</h1>
        <SearchBar initial={criteria} onSearch={handleSearch} compact />
      </section>

      <section className="section">
        {!isValid && (
          <ErrorBanner
            error={new Error('Check the dates above: check-out must be after check-in.')}
          />
        )}

        {isValid && (
          <p className="muted result-summary">
            {criteria.city ? `${criteria.city} - ` : 'All destinations - '}
            {formatDate(criteria.checkIn)} to {formatDate(criteria.checkOut)},{' '}
            {pluralise(criteria.guests, 'guest')}
          </p>
        )}

        {roomsQuery.isPending && isValid && <Spinner label="Searching for rooms" />}
        {roomsQuery.isError && (
          <ErrorBanner error={roomsQuery.error} onRetry={() => void roomsQuery.refetch()} />
        )}

        {roomsQuery.isSuccess && results.length === 0 && (
          <EmptyState
            title="No rooms match those dates"
            description="Try a different destination, shift the dates by a day or two, or reduce the number of guests."
          />
        )}

        <div className="stack">
          {results.map((result) => (
            <RoomCard
              key={`${result.roomType.id}-${result.roomId}`}
              result={result}
              checkIn={criteria.checkIn}
              checkOut={criteria.checkOut}
              guests={criteria.guests}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
