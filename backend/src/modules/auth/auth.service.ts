import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { users } from '../../db/schema';
import { isUserRole, type UserRole } from '../../domain/enums';
import { ConflictError, UnauthorizedError } from '../../errors/AppError';
import { accessTokenLifetime, signAccessToken } from '../../utils/jwt';
import { hashPassword, verifyPassword } from '../../utils/password';
import type { LoginInput, RegisterInput } from './auth.schema';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
  expiresIn: string;
}

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  createdAt: Date;
}

/** Narrows the database `role` string to the domain union, defaulting safely. */
export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: isUserRole(user.role) ? user.role : 'GUEST',
    createdAt: user.createdAt.toISOString(),
  };
}

const publicColumns = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  phone: users.phone,
  role: users.role,
  createdAt: users.createdAt,
};

function issueToken(user: PublicUser): AuthResult {
  return {
    user,
    token: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    expiresIn: accessTokenLifetime(),
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).get();
  if (existing) {
    throw new ConflictError('An account with that email address already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const created = db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone ?? null,
      role: 'GUEST',
    })
    .returning(publicColumns)
    .get();

  return issueToken(toPublicUser(created));
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = db.select().from(users).where(eq(users.email, input.email)).get();

  // Same message and roughly the same work either way, so the response does not
  // reveal whether the address exists.
  if (!user) {
    throw new UnauthorizedError('Email address or password is incorrect');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Email address or password is incorrect');
  }

  return issueToken(toPublicUser(user));
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = db.select(publicColumns).from(users).where(eq(users.id, userId)).get();

  if (!user) {
    throw new UnauthorizedError('Account no longer exists');
  }

  return toPublicUser(user);
}
