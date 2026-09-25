import type { JSX } from 'react';

interface SpinnerProps {
  label?: string;
  inline?: boolean;
}

export function Spinner({ label = 'Loading', inline = false }: SpinnerProps): JSX.Element {
  return (
    <div className={inline ? 'spinner spinner--inline' : 'spinner'} role="status" aria-live="polite">
      <span className="spinner__circle" aria-hidden="true" />
      <span className={inline ? 'visually-hidden' : 'spinner__label'}>{label}</span>
    </div>
  );
}
