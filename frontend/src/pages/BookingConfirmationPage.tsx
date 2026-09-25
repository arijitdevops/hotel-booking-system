import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { getBooking } from '../api/bookings';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { ErrorBanner } from '../components/ErrorBanner';
import { Spinner } from '../components/Spinner';
import { formatCurrency, formatDate, formatDateTime, pluralise } from '../lib/format';

export function BookingConfirmationPage(): JSX.Element {
  const { reference = '' } = useParams<{ reference: string }>();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get('created') === '1';

  const bookingQuery = useQuery({
    queryKey: ['booking', reference],
    queryFn: () => getBooking(reference),
    enabled: reference.length > 0,
  });

  if (bookingQuery.isPending) {
    return <Spinner label="Loading your booking" />;
  }

  if (bookingQuery.isError || !bookingQuery.data) {
    return (
      <div className="page page--narrow">
        <ErrorBanner error={bookingQuery.error} onRetry={() => void bookingQuery.refetch()} />
      </div>
    );
  }

  const { booking } = bookingQuery.data;

  return (
    <div className="page page--narrow">
      {justCreated && (
        <div className="banner banner--success" role="status">
          <div>
            <p className="banner__title">Your booking is confirmed</p>
            <p>A confirmation would normally be emailed to you. Keep the reference below.</p>
          </div>
        </div>
      )}

      <header className="confirmation__header">
        <div>
          <h1 className="page__title">{booking.reference}</h1>
          <p className="muted">Booked on {formatDateTime(booking.createdAt)}</p>
        </div>
        <BookingStatusBadge status={booking.status} />
      </header>

      <section className="card">
        <h2 className="card__title">Stay details</h2>
        <dl className="detail-list">
          <div>
            <dt>Hotel</dt>
            <dd>
              <Link className="link" to={`/hotels/${booking.hotel.slug}`}>
                {booking.hotel.name}
              </Link>
              <br />
              <span className="muted">
                {booking.hotel.addressLine}, {booking.hotel.city}, {booking.hotel.country}
              </span>
            </dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd>
              {booking.roomType.name} (room {booking.room.roomNumber}, floor {booking.room.floor})
              <br />
              <span className="muted">{booking.roomType.bedConfiguration}</span>
            </dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>
              {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
              <br />
              <span className="muted">
                {pluralise(booking.nights, 'night')} &middot; check-in from{' '}
                {booking.hotel.checkInTime}, check-out by {booking.hotel.checkOutTime}
              </span>
            </dd>
          </div>
          <div>
            <dt>Guests</dt>
            <dd>{pluralise(booking.guests, 'guest')}</dd>
          </div>
          {booking.specialRequests && (
            <div>
              <dt>Requests</dt>
              <dd className="preserve-lines">{booking.specialRequests}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card">
        <h2 className="card__title">Payment</h2>
        <dl className="detail-list">
          <div>
            <dt>Total</dt>
            <dd>
              <strong>{formatCurrency(booking.totalAmount)}</strong>
              <br />
              <span className="muted">
                includes {formatCurrency(booking.taxAmount)} taxes and fees
              </span>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {booking.payment ? (
                <>
                  <BookingStatusBadge status={booking.payment.status} />
                  <br />
                  <span className="muted">
                    {booking.payment.method} &middot; {booking.payment.transactionRef}
                    {booking.payment.paidAt ? ` - paid ${formatDate(booking.payment.paidAt)}` : ''}
                  </span>
                </>
              ) : (
                <span className="muted">Not paid yet</span>
              )}
            </dd>
          </div>
          {booking.cancellationFee > 0 && (
            <div>
              <dt>Cancellation fee</dt>
              <dd>{formatCurrency(booking.cancellationFee)}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="button-row">
        <Link className="button button--primary" to="/bookings">
          All my bookings
        </Link>
        <Link className="button button--ghost" to="/search">
          Book another stay
        </Link>
      </div>
    </div>
  );
}
