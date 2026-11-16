'use strict';

const { createApp } = require('./src/app');

/**
 * Vercel entry point.
 *
 * Vercel does not run a persistent server: it invokes this handler per request
 * inside a short-lived (but reusable) Node function. That is why the Express
 * app is exported as a request handler instead of calling app.listen().
 *
 * Routing comes from vercel.json:
 *   /api/(.*) -> api/index.js
 */
const app = createApp();

module.exports = (req, res) => app(req, res);
