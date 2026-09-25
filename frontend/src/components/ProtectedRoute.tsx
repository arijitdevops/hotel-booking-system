import { Navigate, useLocation } from 'react-router-dom';
import type { JSX, ReactNode } from 'react';

import { useAuth } from '../hooks/useAuth';
import { Spinner } from './Spinner';

interface ProtectedRouteProps {
  children: ReactNode;
  /** When set, the signed-in user must also hold this role. */
  requireRole?: 'ADMIN' | 'GUEST';
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps): JSX.Element {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <Spinner label="Checking your session" />;
  }

  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return (
      <div className="page page--narrow">
        <h1>Not available</h1>
        <p className="muted">
          Your account does not have access to this area. Sign in with an administrator account to
          continue.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
