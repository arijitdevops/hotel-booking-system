import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { isProduction } from '../config/env';
import { logger } from '../config/logger';
import { sqliteErrorCode } from '../db/errors';
import { AppError, isAppError } from '../errors/AppError';

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

function zodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function normalise(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError('Request validation failed', 422, 'VALIDATION_ERROR', zodIssues(error));
  }

  switch (sqliteErrorCode(error)) {
    case 'SQLITE_CONSTRAINT_UNIQUE':
    case 'SQLITE_CONSTRAINT_PRIMARYKEY':
      return new AppError('A record with those unique values already exists', 409, 'CONFLICT');
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      return new AppError('Related record does not exist or is still referenced', 409, 'CONFLICT');
    case 'SQLITE_BUSY':
      return new AppError('The database is busy, please retry', 503, 'SERVICE_UNAVAILABLE');
    default:
      break;
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  return new AppError(message, 500, 'INTERNAL_ERROR', undefined, false);
}

/**
 * Central error middleware. Express identifies it by its four arguments, so
 * `next` must stay in the signature even though it is unused.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = normalise(error);

  const logPayload = {
    method: req.method,
    path: req.originalUrl,
    statusCode: appError.statusCode,
    code: appError.code,
  };

  if (appError.statusCode >= 500) {
    logger.error({ ...logPayload, err: error }, appError.message);
  } else {
    logger.warn(logPayload, appError.message);
  }

  const body: ErrorResponseBody = {
    error: {
      code: appError.code,
      message:
        appError.statusCode >= 500 && isProduction
          ? 'Internal server error'
          : appError.message,
    },
  };

  if (appError.details !== undefined) {
    body.error.details = appError.details;
  }
  if (!isProduction && appError.statusCode >= 500 && error instanceof Error) {
    body.error.stack = error.stack;
  }

  res.status(appError.statusCode).json(body);
};
