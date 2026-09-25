import type { JSX } from 'react';
import { titleCase } from '../lib/format';

const TONE_BY_STATUS: Record<string, string> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CHECKED_IN: 'info',
  CHECKED_OUT: 'neutral',
  CANCELLED: 'danger',
  PAID: 'success',
  REFUNDED: 'info',
  FAILED: 'danger',
  AVAILABLE: 'success',
  MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'danger',
};

interface BookingStatusBadgeProps {
  status: string;
}

export function BookingStatusBadge({ status }: BookingStatusBadgeProps): JSX.Element {
  const tone = TONE_BY_STATUS[status] ?? 'neutral';
  return <span className={`badge badge--${tone}`}>{titleCase(status)}</span>;
}
