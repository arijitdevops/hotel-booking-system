import type { JSX } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="page page--narrow page--centered">
      <p className="not-found__code">404</p>
      <h1 className="page__title">That page does not exist</h1>
      <p className="muted">
        The link may be out of date, or the booking reference may have been mistyped.
      </p>
      <div className="button-row">
        <Link className="button button--primary" to="/">
          Back to home
        </Link>
        <Link className="button button--ghost" to="/search">
          Search for a room
        </Link>
      </div>
    </div>
  );
}
