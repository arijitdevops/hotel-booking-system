import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

import { env, isTest } from '../config/env';
import { TooManyRequestsError } from '../errors/AppError';

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

/** No-op limiter so the integration suite is not throttled. */
const passthrough: RequestHandler = (_req, _res, next) => next();

/** Applied to the whole /api surface. */
export const apiRateLimiter: RequestHandler = isTest
  ? passthrough
  : rateLimit({
      windowMs,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(new TooManyRequestsError('Too many requests, please try again later'));
      },
    });

/** Tighter budget for credential endpoints. */
export const authRateLimiter: RequestHandler = isTest
  ? passthrough
  : rateLimit({
      windowMs,
      limit: Math.max(5, Math.floor(env.RATE_LIMIT_MAX / 10)),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      handler: (_req, _res, next) => {
        next(new TooManyRequestsError('Too many authentication attempts, slow down'));
      },
    });
