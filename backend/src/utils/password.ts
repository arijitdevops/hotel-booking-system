import bcrypt from 'bcryptjs';

import { env } from '../config/env';

/** Password hashing. bcrypt cost comes from BCRYPT_ROUNDS. */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
