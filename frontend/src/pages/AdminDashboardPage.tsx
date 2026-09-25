import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type JSX } from 'react';

import { getStats, listBookings, listRooms, updateBookingStatus, updateRoomStatus } from '../api/admin';
import { BookingStatusBadge } from '../components/BookingStatusBadge';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Spinner } from '../components/Spinner';
import { useDebounce } from '../hooks/useDebounce';
import { formatCurrency, formatDate, titleCase } from '../lib/format';

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
const ROOM_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

/** Transitions the API accepts, mirrored so the UI only offers valid moves. */
const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
};

export function AdminDashboardPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => getStats() });

  // Typing in the search box should not fire a request per keystroke.
  const debouncedSearch = useDebounce(search, 350);

  const bookingsQuery = useQuery({
    queryKey: ['admin', 'bookings', { statusFilter, search: debouncedSearch }],
    queryFn: () =>
      listBookings({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        pageSize: 20,
      }),
  });

  const roomsQuery = useQuery({
    queryKey: ['admin', 'rooms'],
    queryFn: () => listRooms({ pageSize: 25 }),
  });

  const bookingStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateBookingStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  const roomStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateRoomStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
    },
  });

  const stats = statsQuery.data;

  return (
    <div className="page">
      <h1 className="page__title">Operations dashboard</h1>

      {statsQuery.isPending && <Spinner label="Loading statistics" />}
      {statsQuery.isError && (
        <ErrorBanner error={statsQuery.error} onRetry={() => void statsQuery.refetch()} />
      )}

      {stats && (
        <>
          <section className="stat-grid">
            <div className="stat">
              <p className="stat__label">Occupancy today</p>
              <p className="stat__value">{stats.occupancy.rate}%</p>
              <p className="stat__hint muted">
                {stats.occupancy.occupiedRooms} of {stats.occupancy.bookableRooms} rooms
              </p>
            </div>
            <div className="stat">
              <p className="stat__label">Arrivals today</p>
              <p className="stat__value">{stats.arrivalsToday}</p>
              <p className="stat__hint muted">{stats.departuresToday} departures</p>
            </div>
            <div className="stat">
              <p className="stat__label">Revenue booked</p>
              <p className="stat__value">{formatCurrency(stats.revenue.confirmedTotal)}</p>
              <p className="stat__hint muted">
                {formatCurrency(stats.revenue.collectedTotal)} collected
              </p>
            </div>
            <div className="stat">
              <p className="stat__label">Average booking</p>
              <p className="stat__value">{formatCurrency(stats.revenue.averageBookingValue)}</p>
              <p className="stat__hint muted">{stats.totals.bookings} bookings all time</p>
            </div>
          </section>

          <section className="section">
            <h2 className="section__title">Bookings by status</h2>
            <ul className="status-list">
              {BOOKING_STATUSES.map((status) => (
                <li key={status} className="status-list__item">
                  <BookingStatusBadge status={status} />
                  <strong>{stats.bookingsByStatus[status] ?? 0}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2 className="section__title">Revenue, last 6 months</h2>
            {stats.revenue.last6Months.length === 0 ? (
              <EmptyState title="No revenue recorded yet" />
            ) : (
              <ul className="bar-chart">
                {stats.revenue.last6Months.map((month) => {
                  const max = Math.max(...stats.revenue.last6Months.map((row) => row.revenue), 1);
                  const height = Math.max(4, Math.round((month.revenue / max) * 100));
                  return (
                    <li key={month.month} className="bar-chart__item">
                      <span className="bar-chart__bar" style={{ height: `${height}%` }} />
                      <span className="bar-chart__label">{month.month}</span>
                      <span className="bar-chart__value muted">
                        {formatCurrency(month.revenue)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="section">
        <div className="section__header">
          <h2 className="section__title">Bookings</h2>
          <div className="filter-row">
            <input
              className="field__input"
              placeholder="Search reference, name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="field__input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {BOOKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {bookingsQuery.isPending && <Spinner label="Loading bookings" />}
        {bookingsQuery.isError && <ErrorBanner error={bookingsQuery.error} />}
        {bookingStatusMutation.isError && <ErrorBanner error={bookingStatusMutation.error} />}

        {bookingsQuery.data && bookingsQuery.data.data.length === 0 && (
          <EmptyState title="No bookings match those filters" />
        )}

        {bookingsQuery.data && bookingsQuery.data.data.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Guest</th>
                  <th scope="col">Hotel</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Total</th>
                  <th scope="col">Status</th>
                  <th scope="col">Move to</th>
                </tr>
              </thead>
              <tbody>
                {bookingsQuery.data.data.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.reference}</td>
                    <td>
                      {booking.guest?.fullName ?? 'Unknown'}
                      <br />
                      <span className="muted">{booking.guest?.email ?? ''}</span>
                    </td>
                    <td>
                      {booking.hotel.name}
                      <br />
                      <span className="muted">Room {booking.room.roomNumber}</span>
                    </td>
                    <td>
                      {formatDate(booking.checkIn)}
                      <br />
                      <span className="muted">to {formatDate(booking.checkOut)}</span>
                    </td>
                    <td>{formatCurrency(booking.totalAmount)}</td>
                    <td>
                      <BookingStatusBadge status={booking.status} />
                    </td>
                    <td>
                      <div className="button-row button-row--tight">
                        {(NEXT_STATUSES[booking.status] ?? []).map((next) => (
                          <button
                            key={next}
                            type="button"
                            className="button button--small"
                            disabled={bookingStatusMutation.isPending}
                            onClick={() =>
                              bookingStatusMutation.mutate({ id: booking.id, status: next })
                            }
                          >
                            {titleCase(next)}
                          </button>
                        ))}
                        {(NEXT_STATUSES[booking.status] ?? []).length === 0 && (
                          <span className="muted">Final</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section__title">Rooms</h2>

        {roomsQuery.isPending && <Spinner label="Loading rooms" />}
        {roomsQuery.isError && <ErrorBanner error={roomsQuery.error} />}
        {roomStatusMutation.isError && <ErrorBanner error={roomStatusMutation.error} />}

        {roomsQuery.data && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Room</th>
                  <th scope="col">Hotel</th>
                  <th scope="col">Type</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Bookings</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {roomsQuery.data.data.map((room) => (
                  <tr key={room.id}>
                    <td>
                      {room.roomNumber}
                      <br />
                      <span className="muted">Floor {room.floor}</span>
                    </td>
                    <td>{room.hotel.name}</td>
                    <td>{room.roomType.name}</td>
                    <td>{formatCurrency(room.roomType.basePricePerNight)}</td>
                    <td>{room.totalBookings}</td>
                    <td>
                      <select
                        className="field__input field__input--small"
                        value={room.status}
                        aria-label={`Status for room ${room.roomNumber}`}
                        disabled={roomStatusMutation.isPending}
                        onChange={(event) =>
                          roomStatusMutation.mutate({ id: room.id, status: event.target.value })
                        }
                      >
                        {ROOM_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {titleCase(status)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
