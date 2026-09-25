import type { JSX } from 'react';
import { formatCurrency, formatShortDate, pluralise } from '../lib/format';
import type { Quote } from '../types';

interface PriceBreakdownProps {
  quote: Quote;
  showNights?: boolean;
}

export function PriceBreakdown({ quote, showNights = true }: PriceBreakdownProps): JSX.Element {
  return (
    <div className="price-breakdown">
      {showNights && (
        <ul className="price-breakdown__nights">
          {quote.nights.map((night) => (
            <li key={night.date} className="price-breakdown__night">
              <span>
                {formatShortDate(night.date)}
                {night.ratePlanName && (
                  <span className="price-breakdown__plan"> {night.ratePlanName}</span>
                )}
              </span>
              <span>{formatCurrency(night.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="price-breakdown__totals">
        <div>
          <dt>{pluralise(quote.nightCount, 'night')} subtotal</dt>
          <dd>{formatCurrency(quote.subtotal)}</dd>
        </div>
        <div>
          <dt>Taxes and fees ({quote.taxPercent}%)</dt>
          <dd>{formatCurrency(quote.tax)}</dd>
        </div>
        <div className="price-breakdown__grand">
          <dt>Total</dt>
          <dd>{formatCurrency(quote.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
