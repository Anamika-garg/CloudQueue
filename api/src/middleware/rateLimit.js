'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiting keeps the public polling endpoints and the demo login from
 * being abused. Note: on Vercel each warm function instance holds its own
 * in-memory counters, so this is a per-instance guard. For a hard global limit
 * swap the store for Upstash Redis (@upstash/ratelimit) - noted in the report.
 */

const disabled = String(process.env.DISABLE_RATE_LIMIT || '').toLowerCase() === 'true';

const handler = (req, res, next, options) =>
  res.status(options.statusCode).json({
    error: {
      code: 'rate_limited',
      message: 'Too many requests. Please slow down and try again shortly.',
    },
  });

function limiter({ windowMs, limit, message }) {
  if (disabled) return (req, res, next) => next();
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: message
      ? (req, res, next, options) =>
          res.status(options.statusCode).json({ error: { code: 'rate_limited', message } })
      : handler,
  });
}

module.exports = {
  publicReadLimiter: limiter({ windowMs: 60_000, limit: 240 }),
  authLimiter: limiter({
    windowMs: 60_000,
    limit: 30,
    message: 'Too many sign-in attempts. Wait a minute and try again.',
  }),
  writeLimiter: limiter({ windowMs: 60_000, limit: 60 }),
};
