'use strict';

const { AppError } = require('../lib/http');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `No API route matches ${req.method} ${req.originalUrl}`,
    },
  });
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = 'internal_error';
  let message = 'Something went wrong. Please try again.';
  let details;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err && err.name === 'ZodError') {
    status = 400;
    code = 'validation_error';
    message = 'Invalid request data';
    details = (err.issues || []).map((issue) => ({
      path: (issue.path || []).join('.'),
      message: issue.message,
    }));
  } else if (err && err.name === 'CastError') {
    status = 400;
    code = 'invalid_identifier';
    message = `Invalid value for "${err.path}"`;
  } else if (err && err.code === 11000) {
    status = 409;
    code = 'duplicate_key';
    message = 'A record with those unique values already exists';
    details = err.keyValue;
  } else if (err && err.name === 'ValidationError') {
    status = 400;
    code = 'validation_error';
    message = 'Invalid request data';
    details = Object.values(err.errors || {}).map((item) => ({
      path: item.path,
      message: item.message,
    }));
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    code = 'invalid_json';
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) {
    console.error('[cloudqueue] unhandled error', {
      path: req.originalUrl,
      method: req.method,
      message: err && err.message,
      stack: err && err.stack,
    });
  }

  const payload = { error: { code, message } };
  if (details) payload.error.details = details;
  if (req.id) payload.error.requestId = req.id;

  res.status(status).json(payload);
}

module.exports = { errorHandler, notFoundHandler };
