import type { Server } from 'node:http';

import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './db/client';

let server: Server | null = null;
let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const closed = new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });

  // Never let a hung connection block the exit for more than 10 seconds.
  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, 10_000).unref();
  });

  await Promise.race([closed, timeout]);

  try {
    await disconnectDatabase();
  } catch (error) {
    logger.error({ err: error }, 'Failed to close the database connection cleanly');
  }

  process.exit(exitCode);
}

async function start(): Promise<void> {
  await connectDatabase();

  server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, environment: env.NODE_ENV },
      `API listening on http://localhost:${env.PORT}`,
    );
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.fatal({ port: env.PORT }, 'Port is already in use');
    } else {
      logger.fatal({ err: error }, 'HTTP server error');
    }
    process.exit(1);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start the API');
  process.exit(1);
});
