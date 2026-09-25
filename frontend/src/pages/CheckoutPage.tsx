import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type JSX } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { createBooking, payForBooking } from '../api/bookings';
import { getRoom } from '../api/rooms';
import { ErrorBanner } from '../components/ErrorBanner';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { defaultCriteria } from '../components/SearchBar';
import { Spinner } from '../components/Spinner';
import { Thumbnail } from '../components/Thumbnail';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, pluralise } from '../lib/format';
import { cardPaymentSchema, fieldErrors, guestDetailsSchema } from '../lib/validation';

interface CheckoutForm {
  fullName: string;
  email: string;
  phone: string;
  specialRequests: string;
  cardHolder: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
}

export function CheckoutPage(): JSX.Element {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fallback = defaultCriteria();

  const checkIn = searchParams.get('checkIn') ?? fallback.checkIn;
  const checkOut = searchParams.get('checkOut') ?? fallback.checkOut;
  const guests = Number(searchParams.get('guests') ?? fallback.guests);

  const [form, setForm] = useState<CheckoutForm>({
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    specialRequests: '',
    cardHolder: user?.fullName ?? '',
    cardNumber: '4242 4242 4242 4242',
    expiryMonth: '12',
    expiryYear: '2030',
    cvc: '123',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const roomQuery = useQuery({
    queryKey: ['room', roomId, { checkIn, checkOut }],
    queryFn: () => getRoom(roomId, { checkIn, checkOut }),
    enabled: roomId.length > 0,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (values: CheckoutForm) => {
      const created = await createBooking({
        roomId,
        checkIn,
        checkOut,
        guests,
        ...(values.specialRequests ? { specialRequests: values.specialRequests } : {}),
      });

      await payForBooking(created.booking.reference, {
        method: 'CARD',
        cardHolder: values.cardHolder,
        cardNumber: values.cardNumber,
        expiryMonth: Number(values.expiryMonth),
        expiryYear: Number(values.expiryYear),
        cvc: values.cvc,
      });

      return created.booking.reference;
    },
    onSuccess: (reference) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(`/bookings/${reference}?created=1`);
    },
  });

  function update<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const guestResult = guestDetailsSchema.safeParse({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      specialRequests: form.specialRequests,
    });
    const cardResult = cardPaymentSchema.safeParse({
      cardHolder: form.cardHolder,
      cardNumber: form.cardNumber,
      expiryMonth: form.expiryMonth,
      expiryYear: form.expiryYear,
      cvc: form.cvc,
    });

    const nextErrors = {
      ...(guestResult.success ? {} : fieldErrors(guestResult.error)),
      ...(cardResult.success ? {} : fieldErrors(cardResult.error)),
    };

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    checkoutMutation.mutate(form);
  }

  if (roomQuery.isPending) {
    return <Spinner label="Loading your selection" />;
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
      <h1 className="page__title">Checkout</h1>

      <div className="checkout">
        <form className="checkout__form" onSubmit={handleSubmit} noValidate>
          <section className="card">
            <h2 className="card__title">Lead guest</h2>

            <div className="field">
              <label className="field__label" htmlFor="checkout-name">
                Full name
              </label>
              <input
                id="checkout-name"
                className="field__input"
                value={form.fullName}
                onChange={(event) => update('fullName', event.target.value)}
                autoComplete="name"
              />
              {errors['fullName'] && <p className="field__error">{errors['fullName']}</p>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="checkout-email">
                Email
              </label>
              <input
                id="checkout-email"
                className="field__input"
                type="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                autoComplete="email"
              />
              {errors['email'] && <p className="field__error">{errors['email']}</p>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="checkout-phone">
                Phone (optional)
              </label>
              <input
                id="checkout-phone"
                className="field__input"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                autoComplete="tel"
              />
              {errors['phone'] && <p className="field__error">{errors['phone']}</p>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="checkout-requests">
                Special requests (optional)
              </label>
              <textarea
                id="checkout-requests"
                className="field__input field__input--textarea"
                rows={3}
                value={form.specialRequests}
                onChange={(event) => update('specialRequests', event.target.value)}
              />
              {errors['specialRequests'] && (
                <p className="field__error">{errors['specialRequests']}</p>
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Payment</h2>
            <p className="muted">
              Payments are simulated. No card details leave the browser beyond this demo API, and
              nothing is stored. A card number ending in 0000 is always declined.
            </p>

            <div className="field">
              <label className="field__label" htmlFor="checkout-card-holder">
                Name on card
              </label>
              <input
                id="checkout-card-holder"
                className="field__input"
                value={form.cardHolder}
                onChange={(event) => update('cardHolder', event.target.value)}
                autoComplete="cc-name"
              />
              {errors['cardHolder'] && <p className="field__error">{errors['cardHolder']}</p>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="checkout-card-number">
                Card number
              </label>
              <input
                id="checkout-card-number"
                className="field__input"
                inputMode="numeric"
                value={form.cardNumber}
                onChange={(event) => update('cardNumber', event.target.value)}
                autoComplete="cc-number"
              />
              {errors['cardNumber'] && <p className="field__error">{errors['cardNumber']}</p>}
            </div>

            <div className="field-row">
              <div className="field field--narrow">
                <label className="field__label" htmlFor="checkout-expiry-month">
                  Month
                </label>
                <input
                  id="checkout-expiry-month"
                  className="field__input"
                  inputMode="numeric"
                  value={form.expiryMonth}
                  onChange={(event) => update('expiryMonth', event.target.value)}
                  autoComplete="cc-exp-month"
                />
                {errors['expiryMonth'] && <p className="field__error">{errors['expiryMonth']}</p>}
              </div>

              <div className="field field--narrow">
                <label className="field__label" htmlFor="checkout-expiry-year">
                  Year
                </label>
                <input
                  id="checkout-expiry-year"
                  className="field__input"
                  inputMode="numeric"
                  value={form.expiryYear}
                  onChange={(event) => update('expiryYear', event.target.value)}
                  autoComplete="cc-exp-year"
                />
                {errors['expiryYear'] && <p className="field__error">{errors['expiryYear']}</p>}
              </div>

              <div className="field field--narrow">
                <label className="field__label" htmlFor="checkout-cvc">
                  CVC
                </label>
                <input
                  id="checkout-cvc"
                  className="field__input"
                  inputMode="numeric"
                  value={form.cvc}
                  onChange={(event) => update('cvc', event.target.value)}
                  autoComplete="cc-csc"
                />
                {errors['cvc'] && <p className="field__error">{errors['cvc']}</p>}
              </div>
            </div>
          </section>

          {checkoutMutation.isError && <ErrorBanner error={checkoutMutation.error} />}

          <button
            type="submit"
            className="button button--primary button--block"
            disabled={checkoutMutation.isPending || room.isAvailable === false}
          >
            {checkoutMutation.isPending
              ? 'Confirming your booking...'
              : room.quote
                ? `Pay ${formatCurrency(room.quote.total)} and book`
                : 'Book this room'}
          </button>
        </form>

        <aside className="checkout__summary card">
          <h2 className="card__title">Your stay</h2>
          <Thumbnail
            src={room.roomType.imageUrl}
            alt={room.roomType.name}
            className="checkout__image"
          />
          <h3>{room.roomType.name}</h3>
          <p className="muted">
            {room.hotel.name} &middot; {room.hotel.city}, {room.hotel.country}
          </p>
          <p className="muted">
            {formatDate(checkIn)} to {formatDate(checkOut)}
          </p>
          <p className="muted">
            {pluralise(guests, 'guest')} &middot; room {room.roomNumber}
          </p>

          {room.quote ? <PriceBreakdown quote={room.quote} /> : null}

          {room.isAvailable === false && (
            <p className="banner banner--warning">
              This room has just been taken for those dates. Please choose another.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
