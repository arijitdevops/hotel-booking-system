/**
 * Typed error hierarchy.
 *
 * Everything thrown on purpose inherits from `AppError`, which carries the HTTP
 * status, a stable machine readable `code` and optional structured `details`.
 * The central error middleware (src/middleware/errorHandler.ts) is the only
 * place that turns these into responses.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  /** Expected errors are safe to show to the client verbatim. */
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The resource is in a conflicting state', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(message, 429, 'RATE_LIMITED', details);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
