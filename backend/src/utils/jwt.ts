import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../config/env';
import { USER_ROLES, type UserRole } from '../domain/enums';
import { UnauthorizedError } from '../errors/AppError';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

const ISSUER = 'hotel-booking-api';

const payloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
});

export function signAccessToken(payload: AccessTokenPayload): string {
  // `expiresIn` is typed as a template literal union ("7d", "15m", ...) in
  // recent @types/jsonwebtoken. The value comes from a validated environment
  // variable, so it is narrowed to that option type rather than widened to any.
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: ISSUER,
    subject: payload.sub,
  };

  return jwt.sign({ email: payload.email, role: payload.role }, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER });
    const parsed = payloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new UnauthorizedError('Malformed access token');
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired');
    }
    throw new UnauthorizedError('Invalid access token');
  }
}

/** Extracts the raw token from an `Authorization: Bearer <token>` header. */
export function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }
  const [scheme, token] = headerValue.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim();
}

/** Seconds until an issued token expires, derived from JWT_EXPIRES_IN. */
export function accessTokenLifetime(): string {
  return env.JWT_EXPIRES_IN;
}
