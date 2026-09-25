import type { JSX } from 'react';
import { formatDate } from '../lib/format';
import type { Review, ReviewSummary } from '../types';
import { EmptyState } from './EmptyState';
import { StarRating } from './StarRating';

interface ReviewListProps {
  reviews: Review[];
  summary?: ReviewSummary;
}

export function ReviewList({ reviews, summary }: ReviewListProps): JSX.Element {
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        description="Guest reviews appear here once a stay has been completed."
      />
    );
  }

  return (
    <div className="review-list">
      {summary && summary.average !== null && (
        <div className="review-summary">
          <div className="review-summary__score">
            <strong>{summary.average.toFixed(1)}</strong>
            <StarRating value={summary.average} size="medium" />
            <span className="muted">{summary.count} reviews</span>
          </div>
          <ul className="review-summary__bars">
            {(['5', '4', '3', '2', '1'] as const).map((star) => {
              const count = summary.distribution[star];
              const percent = summary.count === 0 ? 0 : Math.round((count / summary.count) * 100);
              return (
                <li key={star}>
                  <span className="review-summary__star">{star}</span>
                  <span className="review-summary__track">
                    <span className="review-summary__fill" style={{ width: `${percent}%` }} />
                  </span>
                  <span className="review-summary__count muted">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ul className="review-list__items">
        {reviews.map((review) => (
          <li key={review.id} className="review">
            <header className="review__header">
              <StarRating value={review.rating} />
              <h4 className="review__title">{review.title}</h4>
            </header>
            <p className="review__comment">{review.comment}</p>
            <footer className="review__footer muted">
              {review.author.fullName} &middot; {review.stay.roomTypeName} &middot;{' '}
              {formatDate(review.createdAt)}
            </footer>
          </li>
        ))}
      </ul>
    </div>
  );
}
