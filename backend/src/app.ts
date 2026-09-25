import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { corsOrigins, env, isTest } from './config/env';
import { httpLogStream } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiRateLimiter } from './middleware/rateLimit';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy the client IP comes from X-Forwarded-For, which the
  // rate limiter needs to key on.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false }));

  if (!isTest) {
    app.use(morgan('combined', { stream: httpLogStream }));
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiRateLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
