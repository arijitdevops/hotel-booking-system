import type { JSX } from 'react';

interface StarRatingProps {
  /** 0-5, fractional values are rounded to the nearest half for display. */
  value: number;
  max?: number;
  showValue?: boolean;
  size?: 'small' | 'medium';
}

export function StarRating({
  value,
  max = 5,
  showValue = false,
  size = 'small',
}: StarRatingProps): JSX.Element {
  const rounded = Math.round(value * 2) / 2;

  return (
    <span
      className={`stars stars--${size}`}
      role="img"
      aria-label={`${rounded} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, index) => {
        const position = index + 1;
        const state = rounded >= position ? 'full' : rounded >= position - 0.5 ? 'half' : 'empty';
        return (
          <span key={position} className={`stars__star stars__star--${state}`} aria-hidden="true">
            ★
          </span>
        );
      })}
      {showValue && <span className="stars__value">{value.toFixed(1)}</span>}
    </span>
  );
}
