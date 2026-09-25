import { Router } from 'express';

import { requireAuth } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { loginHandler, meHandler, registerHandler } from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(registerHandler),
);

authRouter.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(loginHandler),
);

authRouter.get('/me', requireAuth, asyncHandler(meHandler));
