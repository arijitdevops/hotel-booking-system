import type { JSX } from 'react';
import { addDaysIso, todayIso } from '../lib/format';

interface DateRangePickerProps {
  checkIn: string;
  checkOut: string;
  onChange: (range: { checkIn: string; checkOut: string }) => void;
  errors?: { checkIn?: string; checkOut?: string };
  idPrefix?: string;
}

/**
 * Two native date inputs kept consistent with each other: past dates are
 * disabled, and moving check-in past check-out pushes check-out along with it.
 */
export function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
  errors,
  idPrefix = 'stay',
}: DateRangePickerProps): JSX.Element {
  const minCheckIn = todayIso();
  const minCheckOut = checkIn ? addDaysIso(checkIn, 1) : addDaysIso(minCheckIn, 1);

  return (
    <>
      <div className="field">
        <label className="field__label" htmlFor={`${idPrefix}-check-in`}>
          Check-in
        </label>
        <input
          id={`${idPrefix}-check-in`}
          className="field__input"
          type="date"
          value={checkIn}
          min={minCheckIn}
          onChange={(event) => {
            const nextCheckIn = event.target.value;
            const nextCheckOut =
              checkOut && checkOut > nextCheckIn ? checkOut : addDaysIso(nextCheckIn, 1);
            onChange({ checkIn: nextCheckIn, checkOut: nextCheckOut });
          }}
          required
        />
        {errors?.checkIn && <p className="field__error">{errors.checkIn}</p>}
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${idPrefix}-check-out`}>
          Check-out
        </label>
        <input
          id={`${idPrefix}-check-out`}
          className="field__input"
          type="date"
          value={checkOut}
          min={minCheckOut}
          onChange={(event) => onChange({ checkIn, checkOut: event.target.value })}
          required
        />
        {errors?.checkOut && <p className="field__error">{errors.checkOut}</p>}
      </div>
    </>
  );
}
