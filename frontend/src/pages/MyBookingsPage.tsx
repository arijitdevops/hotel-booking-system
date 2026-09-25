import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type JSX } from 'react';
import { Link } from 'react-router-dom';

import { cancelBooking, listMyBookings } from '../api/bookings';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Spinner } from '../components/Spinner';
import { Thumbnail } from '../components/Thumbnail';
import { formatCurrency, formatDate, pluralise } from '../lib/format';

type Scope = 'all' | 'upcoming' | 'past';

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

export function MyBookingsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<Scope>('all');
  const [pendingReference, setPendingReference] = useState<string | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', 'me', scope],
    queryFn: () => listMyBookings({ scope, pageSize: 20 }),
  });

  const cancelMutation = useMutation({
    mutationFn: (reference: string) => cancelBooking(reference, 'Cancelled from the web app'),
    onSettled: () => {
      setPendingReference(null);
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  function handleCancel(reference: string, feeAmount: number): void {
    const message =
      feeAmount > 0
        ? `Cancelling now costs ${formatCurrency(feeAmount)}. Continue?`
        : 'Cancel this booking free of charge?';
    if (!window.confirm(message)) {
      return;
    }
    setPendingReference(reference);
    cancelMutation.mutate(reference);
  }

  const bookings = bookingsQuery.data?.data ?? [];

  return (
    <div className="page">
      <h1 className="page__title">My bookings</h1>

      <div className="tabs" role="tablist" aria-label="Booking filter">
        {SCOPES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={scope === option.value}
            className={scope === option.value ? 'tab tab--active' : 'tab'}
            onClick={() => setScope(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {bookingsQuery.isPending && <Spinner label="Loading your bookings" />}
      {bookingsQuery.isError && (
        <ErrorBanner error={bookingsQuery.error} onRetry={() => void bookingsQuery.refetch()} />
      )}
      {cancelMutation.isError && <ErrorBanner error={cancelMutation.error} />}

      {bookingsQuery.isSuccess && bookings.length === 0 && (
        <EmptyState
          title="No bookings here yet"
          description="Once you book a room it will show up on this page."
          action={
            <Link className="button button--primary" to="/search">
              Find a room
            </Link>
          }
        />
      )}

      <div className="stack">
        {bookings.map((booking) => (
          <article key={booking.id} className="card booking-row">
            <Thumbnail
              src={booking.roomType.imageUrl}
              alt={booking.roomType.name}
              className="booking-row__image"
            />

            <div className="booking-row__body">
              <header className="booking-row__header">
                <h2 className="booking-row__title">
                  <Link className="link" to={`/bookings/${booking.reference}`}>
                    {booking.hotel.name}
                  </Link>
                </h2>
                <BookingStatusBadge status={booking.status} />
              </header>

              <p className="muted">
                {booking.roomType.name} &middot; room {booking.room.roomNumber} &middot;{' '}
                {booking.hotel.city}
              </p>
              <p>
                {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)} &middot;{' '}
                {pluralise(booking.nights, 'night')} &middot; {pluralise(booking.guests, 'guest')}
              </p>
              <p className="muted">Reference {booking.reference}</p>
            </div>

            <aside className="booking-row__actions">
              <p className="booking-row__total">{formatCurrency(booking.totalAmount)}</p>
              {booking.cancellation && (
                <p className="muted">
                  {booking.cancellation.isFree
                    ? 'Free cancellation right now'
                    : `Cancelling costs ${formatCurrency(booking.cancellation.feeAmount)}`}
                </p>
              )}
              <Link className="button button--ghost" to={`/bookings/${booking.reference}`}>
                View
              </Link>
              {booking.canCancel && (
                <button
                  type="button"
                  className="button button--danger"
                  disabled={cancelMutation.isPending && pendingReference === booking.reference}
                  onClick={() =>
                    handleCancel(booking.reference, booking.cancellation?.feeAmount ?? 0)
                  }
                >
                  {cancelMutation.isPending && pendingReference === booking.reference
                    ? 'Cancelling...'
                    : 'Cancel'}
                </button>
              )}
            </aside>
          </article>
        ))}
      </div>
    </div>
  );
}
