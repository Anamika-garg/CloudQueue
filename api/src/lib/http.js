'use strict';

/**
 * Every failure that reaches the client is an AppError with a stable machine
 * readable `code` plus an HTTP status. This keeps the API contract predictable
 * for the SPA (`error.code` drives toast copy and auth redirects).
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, 'bad_request', message, details);
const unauthorized = (message = 'Authentication required', code = 'unauthorized') =>
  new AppError(401, code, message);
const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'forbidden', message);
const notFound = (message = 'Resource not found') => new AppError(404, 'not_found', message);
const conflict = (message, code = 'conflict') => new AppError(409, code, message);

/** Wrap async route handlers so rejected promises hit the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  asyncHandler,
};
