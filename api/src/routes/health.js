'use strict';

const express = require('express');
const { config } = require('../config/env');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

/**
 * GET /api/health
 * Monitoring probe. Always answers quickly; reports database reachability so
 * an uptime monitor can distinguish "function running" from "Atlas unavailable".
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const started = Date.now();
    let database = 'unknown';
    let reachable = false;

    try {
      reachable = Boolean(await req.store.ping());
      database = reachable ? req.store.kind : 'unreachable';
    } catch (error) {
      database = 'unreachable';
    }

    const body = {
      status: reachable ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: config.version,
      uptimeSeconds: Math.round(process.uptime()),
      environment: config.nodeEnv,
      authMode: config.demoMode ? 'demo' : 'firebase',
      database,
      latencyMs: Date.now() - started,
    };

    res.status(reachable ? 200 : 503).json(body);
  })
);

module.exports = router;
