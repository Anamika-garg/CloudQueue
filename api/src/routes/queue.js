'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { dateKeyFor } = require('../lib/dateKey');
const { config } = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { publicReadLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { queueQuery } = require('../validation/schemas');
const queueService = require('../services/queueService');

const router = express.Router();

/**
 * GET /api/queue/status?serviceId=...
 * Public, lightweight, polled every few seconds. Contains no personal data -
 * only token numbers and aggregate timing.
 */
router.get(
  '/status',
  publicReadLimiter,
  validate(queueQuery, 'query'),
  asyncHandler(async (req, res) => {
    const service = await queueService.requireService(
      req.store,
      req.valid.query.serviceId,
      { activeOnly: false }
    );
    const snapshot = await queueService.getQueueSnapshot(
      req.store,
      service,
      dateKeyFor(new Date(), config.timezone)
    );
    res.set('Cache-Control', 'no-store');
    res.json(queueService.serializeSnapshot(snapshot));
  })
);

/** GET /api/queue/position?serviceId=... - authenticated position + ETA. */
router.get(
  '/position',
  requireAuth,
  validate(queueQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await queueService.getUserPosition(
      req.store,
      req.user,
      req.valid.query.serviceId
    );
    res.set('Cache-Control', 'no-store');
    res.json(result);
  })
);

/** GET /api/queue/board - public waiting-room display data for all services. */
router.get(
  '/board',
  publicReadLimiter,
  asyncHandler(async (req, res) => {
    const board = await queueService.getDisplayBoard(req.store);
    res.set('Cache-Control', 'no-store');
    res.json(board);
  })
);

module.exports = router;
