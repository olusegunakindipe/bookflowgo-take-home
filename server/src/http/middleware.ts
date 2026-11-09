import type { ErrorRequestHandler, RequestHandler } from 'express';
import {
  AppError,
  BadRequestError,
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

/**
 * Converts framework errors to AppErrors. Body-parser and the router flag client mistakes with a
 * 4xx `status` (bad charset or encoding, malformed URL escape); those are the client's fault and
 * must never become a 500. Anything else unknown is a generic 500.
 */
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const { type, status } = (err ?? {}) as { type?: unknown; status?: unknown };
  if (type === 'entity.parse.failed') return new InvalidJsonError();
  if (type === 'entity.too.large') return new PayloadTooLargeError();
  if (status === 415) return new UnsupportedMediaTypeError();
  if (typeof status === 'number' && status >= 400 && status < 500) return new BadRequestError();
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
