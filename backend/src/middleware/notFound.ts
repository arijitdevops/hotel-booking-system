import type { RequestHandler } from 'express';

import { NotFoundError } from '../errors/AppError';

/** Terminal route: anything that reaches it did not match a router. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} does not exist`));
};
