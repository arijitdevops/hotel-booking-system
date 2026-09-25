import type { JSX } from 'react';

export function Footer(): JSX.Element {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          <strong>Aurora Stays</strong> - a sample hotel booking system built with Express, Prisma,
          SQLite and React.
        </p>
        <p className="muted">
          Demo data only. Payments are simulated and no card details are stored.
        </p>
      </div>
    </footer>
  );
}
