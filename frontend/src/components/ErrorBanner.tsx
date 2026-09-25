import type { JSX } from 'react';
import { ApiError } from '../api/client';

interface ErrorBannerProps {
  error: unknown;
  onRetry?: () => void;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps): JSX.Element | null {
  if (!error) {
    return null;
  }

  const fieldIssues = error instanceof ApiError ? Object.entries(error.fieldErrors) : [];

  return (
    <div className="banner banner--error" role="alert">
      <div>
        <p className="banner__title">{messageFor(error)}</p>
        {fieldIssues.length > 0 && (
          <ul className="banner__list">
            {fieldIssues.map(([field, message]) => (
              <li key={field}>
                <strong>{field}</strong>: {message}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onRetry && (
        <button type="button" className="button button--ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
