import pino from 'pino';

import { env, isProduction } from './env';

/**
 * Application logger.
 *
 * Development uses pino's own pretty-ish single line output via the default
 * destination; production emits newline delimited JSON so it can be shipped to
 * any log aggregator without a transform.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: isProduction ? { service: 'hotel-booking-api' } : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'password', '*.password', '*.passwordHash'],
    remove: true,
  },
});

/** Stream adapter so morgan's access log lines flow through pino. */
export const httpLogStream = {
  write(message: string): void {
    logger.info({ scope: 'http' }, message.trim());
  },
};
