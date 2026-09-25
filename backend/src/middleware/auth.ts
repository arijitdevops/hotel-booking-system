import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { eq } from 'drizzle-orm';

import { db } from '../db/client';
import { users } from '../db/schema';
import { isUserRole, type UserRole } from '../domain/enums';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { extractBearerToken, verifyAccessToken } from '../utils/jwt';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

async function resolveUser(req: Request): Promise<AuthenticatedUser | null> {
  const token = extractBearerToken(req.header('authorization'));
  if (!token) {
    return null;
  }

  const payload = verifyAccessToken(token);

  // The token is only a claim: the account may have been deleted or demoted
  // since it was issued, so the current row is authoritative.
  const user = db
    .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role })
    .from(users)
    .where(eq(users.id, payload.sub))
    .get();

  if (!user || !isUserRole(user.role)) {
    return null;
  }

  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}

/** Rejects the request unless a valid token maps to an existing account. */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  resolveUser(req)
    .then((user) => {
      if (!user) {
        next(new UnauthorizedError('A valid access token is required'));
        return;
      }
      req.user = user;
      next();
    })
    .catch(next);
};

/** Attaches the user when a token is present, but never rejects. */
export const optionalAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  resolveUser(req)
    .then((user) => {
      if (user) {
        req.user = user;
      }
      next();
    })
    .catch(() => next());
};

/** Must run after requireAuth. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new UnauthorizedError('A valid access token is required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('This action requires elevated privileges'));
      return;
    }
    next();
  };
}

/** Ownership guard used by booking routes: admins bypass, guests must match. */
export function assertOwnershipOrAdmin(user: AuthenticatedUser, ownerId: string): void {
  if (user.role === 'ADMIN') {
    return;
  }
  if (user.id !== ownerId) {
    throw new ForbiddenError('You can only access your own bookings');
  }
}

/** Reads the authenticated user, for handlers mounted behind requireAuth. */
export function currentUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError('A valid access token is required');
  }
  return req.user;
}
