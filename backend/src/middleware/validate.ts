import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

import { ValidationError } from '../errors/AppError';

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function toValidationError(error: unknown, source: 'body' | 'query' | 'params'): unknown {
  if (error instanceof ZodError) {
    return new ValidationError(`Invalid request ${source}`, {
      source,
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return error;
}

/**
 * Route guard: rejects a malformed request with 422 before the controller runs.
 *
 * It deliberately does not mutate `req`. Controllers read their input through
 * the typed accessors below, which re-run the same schema on the untouched
 * request. Parsing a request object twice costs nothing measurable and buys
 * fully inferred types in the controller without a single cast.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        next(toValidationError(result.error, 'body'));
        return;
      }
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        next(toValidationError(result.error, 'query'));
        return;
      }
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        next(toValidationError(result.error, 'params'));
        return;
      }
    }
    next();
  };
}

export function parsedBody<TSchema extends ZodTypeAny>(
  req: Request,
  schema: TSchema,
): z.infer<TSchema> {
  return schema.parse(req.body);
}

export function parsedQuery<TSchema extends ZodTypeAny>(
  req: Request,
  schema: TSchema,
): z.infer<TSchema> {
  return schema.parse(req.query);
}

export function parsedParams<TSchema extends ZodTypeAny>(
  req: Request,
  schema: TSchema,
): z.infer<TSchema> {
  return schema.parse(req.params);
}
