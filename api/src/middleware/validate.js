'use strict';

const { AppError } = require('../lib/http');

/**
 * Zod-powered validation.
 *
 * Parsed output is stored on `req.valid[source]` instead of mutating
 * `req.query` (which is a getter in Express 4) so handlers always read
 * sanitised, type-coerced values.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const input = source === 'body' ? req.body ?? {} : req[source] ?? {};
    const result = schema.safeParse(input);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: (issue.path || []).join('.') || source,
        message: issue.message,
      }));
      return next(new AppError(400, 'validation_error', 'Invalid request data', details));
    }

    req.valid = req.valid || {};
    req.valid[source] = result.data;
    return next();
  };
}

module.exports = { validate };
