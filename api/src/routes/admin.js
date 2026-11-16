'use strict';

const express = require('express');
const { asyncHandler, notFound, badRequest } = require('../lib/http');
const { dateKeyFor } = require('../lib/dateKey');
const { config } = require('../config/env');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const {
  callNext,
  markServed,
  statsQuery,
  historyQuery,
  auditQuery,
  updateRole,
} = require('../validation/schemas');
const queueService = require('../services/queueService');
const { recordAudit } = require('../services/audit');

const router = express.Router();

// Every route below requires a valid ID token AND the admin/super_admin role.
router.use(requireAuth, requireRole('admin', 'super_admin'));

/** POST /api/admin/call-next */
router.post(
  '/call-next',
  writeLimiter,
  validate(callNext),
  asyncHandler(async (req, res) => {
    const result = await queueService.callNext(req.store, req, req.valid.body);
    res.json(result);
  })
);

/** POST /api/admin/mark-served/:tokenId  { action: "served" | "no_show" } */
router.post(
  '/mark-served/:tokenId',
  writeLimiter,
  validate(markServed),
  asyncHandler(async (req, res) => {
    const { tokenId } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(tokenId)) throw notFound('Token not found');

    const result = await queueService.completeToken(req.store, req, {
      tokenId,
      action: req.valid.body.action,
      notes: req.valid.body.notes,
    });

    res.json({
      token: {
        id: result.token.id,
        tokenNumber: result.token.tokenNumber,
        status: result.token.status,
        servedAt: result.token.servedAt,
        serviceMinutes: result.token.serviceMinutes,
      },
      message: `Token ${result.token.tokenNumber} marked as ${result.token.status.replace('_', ' ')}`,
      queue: result.queue,
    });
  })
);

/** GET /api/admin/queue?serviceId=&date= - full queue for the control panel. */
router.get(
  '/queue',
  validate(historyQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { serviceId } = req.valid.query;
    const dateKey = req.valid.query.date || dateKeyFor(new Date(), config.timezone);
    if (!serviceId) throw badRequest('serviceId is required');

    const service = await queueService.requireService(req.store, serviceId, { activeOnly: false });
    const [snapshot, tokens] = await Promise.all([
      queueService.getQueueSnapshot(req.store, service, dateKey),
      req.store.tokens.listByServiceDate(service.id, dateKey),
    ]);

    res.json({
      service: queueService.serviceSummary(service),
      dateKey,
      serving: snapshot.serving
        ? {
            id: snapshot.serving.id,
            tokenNumber: snapshot.serving.tokenNumber,
            status: snapshot.serving.status,
            calledAt: snapshot.serving.calledAt,
          }
        : null,
      waitingCount: snapshot.waitingCount,
      estimatedWaitMinutes: snapshot.estimatedWaitMinutes,
      averageServiceMinutes: snapshot.averageServiceMinutes,
      waiting: snapshot.waiting,
      tokens: tokens.map((token) => ({
        id: token.id,
        tokenNumber: token.tokenNumber,
        status: token.status,
        userDisplayName: token.userDisplayName,
        userEmail: token.userEmail,
        issuedAt: token.issuedAt,
        calledAt: token.calledAt,
        servedAt: token.servedAt,
        waitMinutes: token.waitMinutes,
        serviceMinutes: token.serviceMinutes,
        issuedSequence: token.issuedSequence,
      })),
      serverTime: new Date().toISOString(),
    });
  })
);

/** GET /api/admin/stats?serviceId=&date= - daily stats + 24h breakdown. */
router.get(
  '/stats',
  validate(statsQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { serviceId } = req.valid.query;
    const dateKey = req.valid.query.date || dateKeyFor(new Date(), config.timezone);

    const services = serviceId
      ? [await queueService.requireService(req.store, serviceId, { activeOnly: false })]
      : await req.store.services.list({ includeInactive: true });

    const byService = [];
    for (const service of services) {
      byService.push(await queueService.getDailyStats(req.store, { service, dateKey }));
    }

    // Campus-wide roll-up when no service filter is applied.
    const totals = byService.reduce(
      (acc, stat) => {
        acc.totalIssued += stat.totalIssued;
        acc.totalServed += stat.totalServed;
        acc.totalCancelled += stat.totalCancelled;
        acc.totalNoShow += stat.totalNoShow;
        acc.totalWaiting += stat.totalWaiting;
        stat.hourlyBreakdown.forEach((bucket, hour) => {
          acc.hourlyBreakdown[hour].issued += bucket.issued;
          acc.hourlyBreakdown[hour].served += bucket.served;
        });
        return acc;
      },
      {
        dateKey,
        totalIssued: 0,
        totalServed: 0,
        totalCancelled: 0,
        totalNoShow: 0,
        totalWaiting: 0,
        hourlyBreakdown: Array.from({ length: 24 }, (_, hour) => ({
          hour,
          issued: 0,
          served: 0,
          avgWaitMinutes: 0,
        })),
      }
    );

    const weighted = byService.filter((stat) => stat.averageWaitMinutes > 0 && stat.totalIssued > 0);
    totals.averageWaitMinutes = weighted.length
      ? Math.round(
          (weighted.reduce((sum, stat) => sum + stat.averageWaitMinutes * stat.totalIssued, 0) /
            weighted.reduce((sum, stat) => sum + stat.totalIssued, 0)) *
            10
        ) / 10
      : 0;

    res.json({
      dateKey,
      stats: serviceId ? byService[0] : totals,
      byService,
      service: serviceId ? queueService.serviceSummary(services[0]) : null,
    });
  })
);

/** GET /api/admin/history?serviceId=&date=&page=&limit= */
router.get(
  '/history',
  validate(historyQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { serviceId, status, page, limit } = req.valid.query;
    const dateKey = req.valid.query.date || dateKeyFor(new Date(), config.timezone);

    const { items, total } = await req.store.tokens.paginate({
      serviceId,
      dateKey,
      status,
      page,
      limit,
    });

    res.json({
      dateKey,
      history: items.map((token) => ({
        id: token.id,
        tokenNumber: token.tokenNumber,
        serviceCode: token.serviceCode,
        serviceName: token.serviceName,
        status: token.status,
        userDisplayName: token.userDisplayName,
        userEmail: token.userEmail,
        issuedAt: token.issuedAt,
        calledAt: token.calledAt,
        servedAt: token.servedAt,
        waitMinutes: token.waitMinutes,
        serviceMinutes: token.serviceMinutes,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

/** GET /api/admin/audit - recent privileged actions. */
router.get(
  '/audit',
  validate(auditQuery, 'query'),
  asyncHandler(async (req, res) => {
    const entries = await req.store.audit.list({
      limit: req.valid.query.limit,
      action: req.valid.query.action,
    });
    res.json({ entries });
  })
);

/** GET /api/admin/services - includes inactive services. */
router.get(
  '/services',
  asyncHandler(async (req, res) => {
    const services = await req.store.services.list({ includeInactive: true });
    res.json({ services: services.map(queueService.serviceSummary) });
  })
);

/** GET /api/admin/users - super_admin only. */
router.get(
  '/users',
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const users = await req.store.users.list();
    res.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      })),
    });
  })
);

/** PATCH /api/admin/users/:id/role - super_admin only. */
router.patch(
  '/users/:id/role',
  requireRole('super_admin'),
  validate(updateRole),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f0-9]{24}$/i.test(id)) throw notFound('User not found');

    const user = await req.store.users.findById(id);
    if (!user) throw notFound('User not found');

    if (user.id === req.user.id && req.valid.body.role !== 'super_admin') {
      throw badRequest('You cannot remove your own super_admin role');
    }

    const updated = await req.store.users.updateRole(id, req.valid.body.role);

    await recordAudit(req.store, req, 'user.role_update', {
      target: { type: 'user', id, label: user.email },
      metadata: { from: user.role, to: updated.role },
    });

    res.json({
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
      },
    });
  })
);

module.exports = router;
