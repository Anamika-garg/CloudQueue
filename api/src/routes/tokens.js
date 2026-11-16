'use strict';

const express = require('express');
const { asyncHandler, notFound, badRequest } = require('../lib/http');
const { isValidDateKey } = require('../lib/dateKey');
const { requireAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { issueToken } = require('../validation/schemas');
const queueService = require('../services/queueService');

const router = express.Router();

/** POST /api/tokens - generate a token for { serviceId }. */
router.post(
  '/',
  requireAuth,
  writeLimiter,
  validate(issueToken),
  asyncHandler(async (req, res) => {
    const result = await queueService.issueToken(req.store, req, req.valid.body.serviceId);
    res.status(201).json(result);
  })
);

/** GET /api/tokens/my?date=YYYY-MM-DD - active tokens + recent history. */
router.get(
  '/my',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (date && !isValidDateKey(date)) throw badRequest('date must be YYYY-MM-DD');
    const overview = await queueService.getUserOverview(req.store, req.user, { dateKey: date });
    res.json(overview);
  })
);

/** DELETE /api/tokens/:id - cancel your own waiting token (admins may cancel any). */
router.delete(
  '/:id',
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(id)) throw notFound('Token not found');
    const token = await queueService.cancelToken(req.store, req, id);
    res.json({
      token: {
        id: token.id,
        tokenNumber: token.tokenNumber,
        status: token.status,
        cancelledBy: token.cancelledBy,
      },
      message: `Token ${token.tokenNumber} cancelled`,
    });
  })
);

module.exports = router;
