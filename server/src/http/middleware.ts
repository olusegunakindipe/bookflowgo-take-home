import type { ErrorRequestHandler, RequestHandler } from 'express';
import {
  AppError,
  InternalError,
  InvalidJsonError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from './errors';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/** Requests that carry a body must declare JSON; anything else gets a 415. */
export const requireJsonBody: RequestHandler = (req, _res, next) => {
  if (BODY_METHODS.has(req.method) && !req.is('application/json')) {
    next(new UnsupportedMediaTypeError());
    return;
  }
  next();
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route not found'));
};

/** Converts body-parser failures to AppErrors; anything unknown becomes a generic 500. */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const type = (err as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') return new InvalidJsonError();
  if (type === 'entity.too.large') return new PayloadTooLargeError();
  return new InternalError();
}

/** The single place where errors become HTTP responses. Internals are logged, never sent. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const appError = toAppError(err);
  if (appError.status >= 500) console.error(err);
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && { details: appError.details }),
    },
  });
};
