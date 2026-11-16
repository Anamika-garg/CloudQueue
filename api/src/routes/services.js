'use strict';

const express = require('express');
const { asyncHandler, conflict, notFound } = require('../lib/http');
const { requireAuth, requireRole } = require('../middleware/auth');
const { publicReadLimiter, writeLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { createService, updateService } = require('../validation/schemas');
const { serviceSummary } = require('../services/queueService');
const { recordAudit } = require('../services/audit');

const router = express.Router();

/** GET /api/services - public list of active services. */
router.get(
  '/',
  publicReadLimiter,
  asyncHandler(async (req, res) => {
    const services = await req.store.services.list();
    res.json({ services: services.map(serviceSummary) });
  })
);

/** POST /api/services - super_admin only. */
router.post(
  '/',
  requireAuth,
  requireRole('super_admin'),
  writeLimiter,
  validate(createService),
  asyncHandler(async (req, res) => {
    const payload = req.valid.body;
    const existing = await req.store.services.findByCode(payload.code);
    if (existing) {
      throw conflict(`A service with code ${payload.code} already exists`, 'duplicate_service_code');
    }

    const service = await req.store.services.create({
      ...payload,
      createdBy: req.user.id,
    });

    await recordAudit(req.store, req, 'service.create', {
      target: { type: 'service', id: service.id, label: service.code },
      serviceId: service.id,
      metadata: payload,
    });

    res.status(201).json({ service: serviceSummary(service) });
  })
);

/** PATCH /api/services/:id - super_admin only. */
router.patch(
  '/:id',
  requireAuth,
  requireRole('super_admin'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(id)) throw notFound('Service not found');

    const parsed = updateService.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'validation_error',
          message: 'Invalid request data',
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    const service = await req.store.services.findById(id);
    if (!service) throw notFound('Service not found');

    const patch = parsed.data;
    if (patch.code && patch.code !== service.code) {
      const clash = await req.store.services.findByCode(patch.code);
      if (clash) throw conflict(`Code ${patch.code} is already in use`, 'duplicate_service_code');
    }

    const updated = await req.store.services.update(id, patch);

    await recordAudit(req.store, req, 'service.update', {
      target: { type: 'service', id, label: updated.code },
      serviceId: id,
      metadata: { changes: patch },
    });

    res.json({ service: serviceSummary(updated) });
  })
);

/**
 * DELETE /api/services/:id - super_admin only.
 * Services that already have tokens are deactivated instead of deleted so
 * historical reporting stays intact.
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('super_admin'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(id)) throw notFound('Service not found');

    const service = await req.store.services.findById(id);
    if (!service) throw notFound('Service not found');

    const tokenCount = await req.store.services.countTokens(id);
    if (tokenCount > 0) {
      const updated = await req.store.services.update(id, { isActive: false });
      await recordAudit(req.store, req, 'service.update', {
        target: { type: 'service', id, label: service.code },
        serviceId: id,
        metadata: { deactivated: true, reason: 'delete requested but tokens exist' },
      });
      return res.json({
        service: serviceSummary(updated),
        deleted: false,
        message: 'Service deactivated (it has historical tokens, so it was not removed)',
      });
    }

    await req.store.services.remove(id);
    await recordAudit(req.store, req, 'service.delete', {
      target: { type: 'service', id, label: service.code },
      serviceId: id,
      metadata: { deleted: true },
    });

    res.json({ deleted: true, message: `Service ${service.code} deleted` });
  })
);

/** GET /api/services/:id - public single service (used by deep links). */
router.get(
  '/:id',
  publicReadLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(id)) throw notFound('Service not found');
    const service = await req.store.services.findById(id);
    if (!service) throw notFound('Service not found');
    res.json({ service: serviceSummary(service) });
  })
);

module.exports = router;
