import type { JSX } from 'react';
import { Outlet } from 'react-router-dom';

import { Footer } from './Footer';
import { Header } from './Header';

export function Layout(): JSX.Element {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
