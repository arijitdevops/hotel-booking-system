import type { JSX } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

export function Header(): JSX.Element {
  const { user, status, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut(): void {
    signOut();
    navigate('/');
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" to="/">
          <span className="brand__mark" aria-hidden="true">
            AS
          </span>
          <span className="brand__name">Aurora Stays</span>
        </Link>

        <nav className="site-nav" aria-label="Main">
          <NavLink to="/" end className="site-nav__link">
            Home
          </NavLink>
          <NavLink to="/search" className="site-nav__link">
            Find a room
          </NavLink>
          {status === 'authenticated' && (
            <NavLink to="/bookings" className="site-nav__link">
              My bookings
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className="site-nav__link">
              Admin
            </NavLink>
          )}
        </nav>

        <div className="site-header__account">
          {status === 'authenticated' && user ? (
            <>
              <span className="site-header__user">{user.fullName}</span>
              <button type="button" className="button button--ghost" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="button button--ghost" to="/login">
                Sign in
              </Link>
              <Link className="button button--primary" to="/register">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
