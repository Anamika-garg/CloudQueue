'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { config } = require('./config/env');
const { getStore } = require('./db');
const { errorHandler, notFoundHandler } = require('./middleware/errors');

const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const tokenRoutes = require('./routes/tokens');
const queueRoutes = require('./routes/queue');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');

/**
 * Builds the Express application.
 *
 * The same factory is used by Vercel (`api/index.js` exports the handler) and
 * by the local dev server (`api/dev-server.js`, which also serves the built SPA
 * on a single port). No `app.listen()` happens here - Vercel owns the socket.
 */
function createApp({ staticDir } = {}) {
  const app = express();

  app.disable('x-powered-by');
  // Vercel terminates TLS at its edge and forwards X-Forwarded-*.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // This process only returns JSON; the SPA is served by Vercel's CDN.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / curl / server-to-server requests have no Origin header.
        if (!origin) return callback(null, true);
        if (config.frontendOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining'],
      maxAge: 86400,
    })
  );

  app.use(express.json({ limit: '64kb' }));

  app.use((req, res, next) => {
    req.id = req.get('x-request-id') || crypto.randomUUID();
    res.setHeader('x-request-id', req.id);
    if (!config.isProduction && !config.isVercel) {
      const start = Date.now();
      res.on('finish', () => {
        console.log(
          `[cloudqueue] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`
        );
      });
    }
    next();
  });

  // Resolve the store once per request (cached promise across invocations).
  app.use(async (req, res, next) => {
    try {
      req.store = await getStore();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api', (req, res) => {
    res.json({
      name: 'CloudQueue API',
      version: config.version,
      authMode: config.demoMode ? 'demo' : 'firebase',
      database: config.useMongo ? 'mongodb-atlas' : 'in-memory',
      docs: 'https://github.com/your-org/cloudqueue#api-endpoints',
      endpoints: [
        'POST   /api/auth/sync',
        'GET    /api/auth/me',
        'POST   /api/auth/demo-login        (demo mode only)',
        'GET    /api/services',
        'POST   /api/services               (super_admin)',
        'PATCH  /api/services/:id           (super_admin)',
        'DELETE /api/services/:id           (super_admin)',
        'POST   /api/tokens',
        'GET    /api/tokens/my',
        'DELETE /api/tokens/:id',
        'GET    /api/queue/status?serviceId=',
        'GET    /api/queue/position?serviceId=',
        'GET    /api/queue/board',
        'POST   /api/admin/call-next        (admin)',
        'POST   /api/admin/mark-served/:id  (admin)',
        'GET    /api/admin/queue            (admin)',
        'GET    /api/admin/stats            (admin)',
        'GET    /api/admin/history          (admin)',
        'GET    /api/admin/audit            (admin)',
        'GET    /api/health',
      ],
    });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/tokens', tokenRoutes);
  app.use('/api/queue', queueRoutes);
  app.use('/api/admin', adminRoutes);

  if (staticDir) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
