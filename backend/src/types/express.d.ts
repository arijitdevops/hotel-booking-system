import type { AuthenticatedUser } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      /** Present only after requireAuth / optionalAuth has run. */
      user?: AuthenticatedUser;
    }
  }
}

export {};
