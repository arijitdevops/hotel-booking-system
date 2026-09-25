import { useState, type FormEvent, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listCities } from '../api/hotels';
import { addDaysIso, todayIso } from '../lib/format';
import { fieldErrors, searchSchema } from '../lib/validation';
import { DateRangePicker } from './DateRangePicker';

export interface SearchCriteria {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

interface SearchBarProps {
  initial?: Partial<SearchCriteria>;
  onSearch: (criteria: SearchCriteria) => void;
  compact?: boolean;
}

export function defaultCriteria(): SearchCriteria {
  const checkIn = addDaysIso(todayIso(), 14);
  return { city: '', checkIn, checkOut: addDaysIso(checkIn, 3), guests: 2 };
}

export function SearchBar({ initial, onSearch, compact = false }: SearchBarProps): JSX.Element {
  const base = defaultCriteria();
  const [criteria, setCriteria] = useState<SearchCriteria>({
    city: initial?.city ?? base.city,
    checkIn: initial?.checkIn ?? base.checkIn,
    checkOut: initial?.checkOut ?? base.checkOut,
    guests: initial?.guests ?? base.guests,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const citiesQuery = useQuery({
    queryKey: ['cities'],
    queryFn: () => listCities(),
    staleTime: 5 * 60 * 1000,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = searchSchema.safeParse(criteria);

    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }

    setErrors({});
    onSearch({
      city: result.data.city ?? '',
      checkIn: result.data.checkIn,
      checkOut: result.data.checkOut,
      guests: result.data.guests,
    });
  }

  return (
    <form className={compact ? 'search-bar search-bar--compact' : 'search-bar'} onSubmit={handleSubmit}>
      <div className="field">
        <label className="field__label" htmlFor="search-city">
          Destination
        </label>
        <input
          id="search-city"
          className="field__input"
          list="search-city-options"
          placeholder="Anywhere"
          value={criteria.city}
          onChange={(event) => setCriteria((current) => ({ ...current, city: event.target.value }))}
        />
        <datalist id="search-city-options">
          {(citiesQuery.data?.cities ?? []).map((option) => (
            <option key={`${option.city}-${option.country}`} value={option.city}>
              {option.city}, {option.country}
            </option>
          ))}
        </datalist>
        {errors['city'] && <p className="field__error">{errors['city']}</p>}
      </div>

      <DateRangePicker
        checkIn={criteria.checkIn}
        checkOut={criteria.checkOut}
        onChange={(range) => setCriteria((current) => ({ ...current, ...range }))}
        errors={{ checkIn: errors['checkIn'], checkOut: errors['checkOut'] }}
        idPrefix="search"
      />

      <div className="field field--narrow">
        <label className="field__label" htmlFor="search-guests">
          Guests
        </label>
        <input
          id="search-guests"
          className="field__input"
          type="number"
          min={1}
          max={10}
          value={criteria.guests}
          onChange={(event) =>
            setCriteria((current) => ({ ...current, guests: Number(event.target.value) }))
          }
        />
        {errors['guests'] && <p className="field__error">{errors['guests']}</p>}
      </div>

      <div className="search-bar__actions">
        <button type="submit" className="button button--primary">
          Search
        </button>
      </div>
    </form>
  );
}
