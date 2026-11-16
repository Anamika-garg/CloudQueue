'use strict';

/**
 * Local development server.
 *
 * - Serves the REST API exactly like Vercel does (same Express app).
 * - If `client/dist` exists it also serves the built SPA, so the whole product
 *   runs on http://localhost:4000.
 * - For hot reloading run `npm run client:dev` in a second terminal; Vite proxies
 *   /api to this server (see client/vite.config.js).
 */

const fs = require('fs');
const path = require('path');
const { createApp } = require('./src/app');
const { config } = require('./src/config/env');

const distDir = path.resolve(__dirname, '..', 'client', 'dist');
const staticDir = fs.existsSync(path.join(distDir, 'index.html')) ? distDir : undefined;

const app = createApp({ staticDir });

const server = app.listen(config.port, () => {
  console.log('');
  console.log('  CloudQueue API');
  console.log(`  -> http://localhost:${config.port}/api/health`);
  console.log(`  -> http://localhost:${config.port}/api`);
  console.log(`  auth mode : ${config.demoMode ? 'demo (HMAC tokens)' : 'firebase'}`);
  console.log(`  database  : ${config.useMongo ? 'MongoDB Atlas' : 'in-memory (resets on restart)'}`);
  console.log(`  frontend  : ${staticDir ? 'serving client/dist' : 'run `npm run client:dev`'}`);
  console.log('');
});

const shutdown = (signal) => {
  console.log(`\n[cloudqueue] ${signal} received, closing server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
