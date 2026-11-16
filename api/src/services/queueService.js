'use strict';

const { config } = require('../config/env');
const { dateKeyFor } = require('../lib/dateKey');
const { badRequest, notFound, conflict, forbidden } = require('../lib/http');
const { effectiveServiceMinutes, minutesBetween, round1, computeDailyStats } = require('../lib/metrics');
const { recordAudit } = require('./audit');

/**
 * Queue domain logic. Kept independent of Express so it can be unit tested and
 * so both adapters (Mongo / memory) execute identical rules.
 */

const PUBLIC_AHEAD_LIMIT = 30;

async function requireService(store, serviceId, { activeOnly = true } = {}) {
  if (!serviceId) throw badRequest('serviceId is required');
  const service = await store.services.findById(serviceId);
  if (!service) throw notFound('Service not found');
  if (activeOnly && !service.isActive) {
    throw conflict('This service is currently closed for new tokens', 'service_inactive');
  }
  return service;
}

const publicQueueEntry = (token, position) => ({
  tokenNumber: token.tokenNumber,
  position,
  issuedAt: token.issuedAt,
  waitingMinutes: round1(minutesBetween(token.issuedAt, new Date()) || 0),
});

const publicServing = (token) =>
  token
    ? {
        id: token.id,
        tokenNumber: token.tokenNumber,
        calledAt: token.calledAt,
        status: token.status,
      }
    : null;

/**
 * Reads the live state for one service/day. Everything the polling endpoints
 * need comes from a single call.
 */
async function getQueueSnapshot(store, service, dateKey) {
  const [state, waitingTokens, recentServed] = await Promise.all([
    store.queue.get(service.id, dateKey),
    store.tokens.listWaiting(service.id, dateKey),
    store.tokens.listServedRecent(service.id, dateKey, 8),
  ]);

  let serving = null;
  if (state && state.currentServingTokenId) {
    serving = await store.tokens.findById(state.currentServingTokenId);
    if (serving && serving.status !== 'serving') serving = null;
  }

  const averageServiceMinutes = effectiveServiceMinutes(service, recentServed);
  const now = new Date();

  // A brand-new arrival waits for the token being served (if any) plus everyone
  // already in line.
  const estimatedWaitMinutes = Math.max(
    0,
    Math.round((waitingTokens.length + (serving ? 1 : 0)) * averageServiceMinutes)
  );

  return {
    service,
    dateKey,
    serving,
    waitingTokens,
    waitingCount: waitingTokens.length,
    waiting: waitingTokens
      .slice(0, PUBLIC_AHEAD_LIMIT)
      .map((token, index) => publicQueueEntry(token, index + 1)),
    averageServiceMinutes,
    estimatedWaitMinutes,
    state,
    lastUpdatedAt: now.toISOString(),
  };
}

function serializeSnapshot(snapshot) {
  return {
    service: {
      id: snapshot.service.id,
      code: snapshot.service.code,
      name: snapshot.service.name,
      description: snapshot.service.description,
      location: snapshot.service.location,
      color: snapshot.service.color,
      averageServiceMinutes: snapshot.service.averageServiceMinutes,
      isActive: snapshot.service.isActive,
    },
    dateKey: snapshot.dateKey,
    serving: publicServing(snapshot.serving),
    waitingCount: snapshot.waitingCount,
    waiting: snapshot.waiting,
    averageServiceMinutes: snapshot.averageServiceMinutes,
    estimatedWaitMinutes: snapshot.estimatedWaitMinutes,
    lastUpdatedAt: snapshot.lastUpdatedAt,
    serverTime: new Date().toISOString(),
  };
}

/** 1-based place in the waiting line; 0 means "being served right now". */
function positionOf(token, snapshot) {
  if (!token) return null;
  if (token.status === 'serving') return 0;
  const ahead = snapshot.waitingTokens.filter(
    (candidate) => candidate.issuedSequence < token.issuedSequence
  ).length;
  return ahead + 1;
}

/** ETA = everyone ahead + the person currently at the counter. */
function etaFor(position, snapshot) {
  if (position === null) return null;
  if (position === 0) return 0;
  return Math.max(
    0,
    Math.round(((position - 1) + (snapshot.serving ? 1 : 0)) * snapshot.averageServiceMinutes)
  );
}

/** Rich view of one token, safe to return to its owner or an admin. */
function tokenView(token, snapshot) {
  if (!token) return null;
  const position = positionOf(token, snapshot);
  return {
    id: token.id,
    tokenNumber: token.tokenNumber,
    status: token.status,
    serviceId: token.serviceId,
    serviceCode: token.serviceCode,
    serviceName: token.serviceName,
    issuedAt: token.issuedAt,
    calledAt: token.calledAt,
    servedAt: token.servedAt,
    dateKey: token.dateKey,
    position,
    estimatedWaitMinutes: etaFor(position, snapshot),
    ahead:
      token.status === 'waiting'
        ? snapshot.waitingTokens
            .filter((candidate) => candidate.issuedSequence < token.issuedSequence)
            .map((candidate) => candidate.tokenNumber)
        : [],
    currentServingToken: snapshot.serving ? snapshot.serving.tokenNumber : null,
    waitingCount: snapshot.waitingCount,
  };
}

function serviceSummary(service) {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    description: service.description,
    location: service.location,
    color: service.color,
    averageServiceMinutes: service.averageServiceMinutes,
    isActive: service.isActive,
  };
}

/**
 * Token issue. The sequence comes from an atomic $inc, so two students tapping
 * "Get token" at the same millisecond still receive REG-014 and REG-015.
 */
async function issueToken(store, req, serviceId) {
  const service = await requireService(store, serviceId);
  const dateKey = dateKeyFor(new Date(), config.timezone);

  const existing = await store.tokens.findActiveByUser(req.user.id, {
    serviceId: service.id,
    dateKey,
  });
  if (existing) {
    throw conflict(
      `You already hold token ${existing.tokenNumber} for ${service.name}. Cancel it before taking a new one.`,
      'active_token_exists'
    );
  }

  const now = new Date();
  const snapshotBefore = await getQueueSnapshot(store, service, dateKey);
  const sequence = await store.queue.nextSequence(service.id, dateKey);
  const tokenNumber = `${service.code}-${String(sequence).padStart(3, '0')}`;
  const positionAtIssue = snapshotBefore.waitingCount + 1;

  const token = await store.tokens.create({
    tokenNumber,
    serviceId: service.id,
    serviceCode: service.code,
    serviceName: service.name,
    userId: req.user.id,
    userEmail: req.user.email,
    userDisplayName: req.user.displayName || req.user.email,
    status: 'waiting',
    issuedSequence: sequence,
    issuedAt: now,
    dateKey,
    positionAtIssue,
  });

  await recordAudit(store, req, 'token.issue', {
    target: { type: 'token', id: token.id, label: token.tokenNumber },
    serviceId: service.id,
    metadata: { sequence, positionAtIssue },
  });

  const snapshot = await getQueueSnapshot(store, service, dateKey);
  return {
    token: tokenView(token, snapshot),
    service: serviceSummary(service),
    queue: serializeSnapshot(snapshot),
  };
}

/** Move the queue forward atomically. */
async function callNext(store, req, { serviceId, dateKey }) {
  const service = await requireService(store, serviceId, { activeOnly: false });
  const key = dateKey || dateKeyFor(new Date(), config.timezone);
  const state = await store.queue.get(service.id, key);

  let previous = null;
  if (state && state.currentServingTokenId) {
    const current = await store.tokens.findById(state.currentServingTokenId);
    if (current && current.status === 'serving') {
      const now = new Date();
      previous = await store.tokens.update(current.id, {
        status: 'served',
        servedAt: now,
        completedAt: now,
        serviceMinutes: current.calledAt
          ? round1(minutesBetween(current.calledAt, now))
          : round1(minutesBetween(current.issuedAt, now)),
      });
      await recordAudit(store, req, 'queue.mark_served', {
        target: { type: 'token', id: current.id, label: current.tokenNumber },
        serviceId: service.id,
        metadata: { automatic: true, reason: 'replaced by call-next', serviceMinutes: previous.serviceMinutes },
      });
    }
  }

  const now = new Date();
  const next = await store.tokens.claimNext(service.id, key, now);

  if (next) {
    await store.queue.setServing(service.id, key, next.id, now);
  } else {
    await store.queue.clearServingIf(service.id, key, state && state.currentServingTokenId);
  }

  await recordAudit(store, req, 'queue.call_next', {
    target: next ? { type: 'token', id: next.id, label: next.tokenNumber } : { type: 'queue', id: null, label: 'empty' },
    serviceId: service.id,
    metadata: { previous: previous ? previous.tokenNumber : null, dateKey: key },
  });

  const snapshot = await getQueueSnapshot(store, service, key);
  return {
    previousToken: previous ? publicServing({ ...previous, status: 'served' }) : null,
    serving: next ? tokenView(next, snapshot) : null,
    message: next ? `Now serving ${next.tokenNumber}` : 'The queue is empty - no tokens are waiting.',
    queue: serializeSnapshot(snapshot),
  };
}

/** Mark a specific token served or no-show (edge-case handling). */
async function completeToken(store, req, { tokenId, action, notes }) {
  const token = await store.tokens.findById(tokenId);
  if (!token) throw notFound('Token not found');

  if (['served', 'cancelled', 'no_show'].includes(token.status)) {
    throw conflict(`Token ${token.tokenNumber} is already closed (${token.status})`, 'token_closed');
  }

  const now = new Date();
  const patch =
    action === 'served'
      ? {
          status: 'served',
          servedAt: now,
          completedAt: now,
          serviceMinutes: token.calledAt ? round1(minutesBetween(token.calledAt, now)) : null,
          notes: notes || token.notes,
        }
      : {
          status: 'no_show',
          completedAt: now,
          notes: notes || token.notes,
        };

  const updated = await store.tokens.update(token.id, patch);
  await store.queue.clearServingIf(token.serviceId, token.dateKey, token.id);

  await recordAudit(store, req, action === 'served' ? 'queue.mark_served' : 'queue.mark_no_show', {
    target: { type: 'token', id: token.id, label: token.tokenNumber },
    serviceId: token.serviceId,
    metadata: { from: token.status, ...patch, notes: notes || undefined },
  });

  const service = await store.services.findById(token.serviceId);
  const snapshot = service ? await getQueueSnapshot(store, service, token.dateKey) : null;

  return {
    token: updated,
    queue: snapshot ? serializeSnapshot(snapshot) : null,
  };
}

async function cancelToken(store, req, tokenId) {
  const token = await store.tokens.findById(tokenId);
  if (!token) throw notFound('Token not found');

  const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
  if (token.userId !== req.user.id && !isAdmin) {
    throw forbidden('You can only cancel your own tokens');
  }
  if (token.status !== 'waiting') {
    throw conflict(
      `Token ${token.tokenNumber} can no longer be cancelled (status: ${token.status})`,
      'token_not_cancellable'
    );
  }

  const updated = await store.tokens.update(token.id, {
    status: 'cancelled',
    cancelledBy: isAdmin && token.userId !== req.user.id ? 'admin' : 'user',
    completedAt: new Date(),
  });

  await store.queue.clearServingIf(token.serviceId, token.dateKey, token.id);

  await recordAudit(store, req, 'token.cancel', {
    target: { type: 'token', id: token.id, label: token.tokenNumber },
    serviceId: token.serviceId,
    metadata: { cancelledBy: updated.cancelledBy },
  });

  return updated;
}

/** Everything the user dashboard needs in one round trip. */
async function getUserOverview(store, user, { dateKey } = {}) {
  const key = dateKey || dateKeyFor(new Date(), config.timezone);
  const [recent, services] = await Promise.all([
    store.tokens.listByUser(user.id, { limit: 50 }),
    store.services.list(),
  ]);

  const serviceMap = new Map(services.map((service) => [service.id, service]));
  const active = [];

  for (const token of recent) {
    if (!['waiting', 'serving'].includes(token.status) || token.dateKey !== key) continue;
    const service = serviceMap.get(token.serviceId) || (await store.services.findById(token.serviceId));
    if (!service) continue;
    const snapshot = await getQueueSnapshot(store, service, token.dateKey);
    active.push({ ...tokenView(token, snapshot), service: serviceSummary(service) });
  }

  return {
    dateKey: key,
    active,
    history: recent.map((token) => ({
      id: token.id,
      tokenNumber: token.tokenNumber,
      serviceCode: token.serviceCode,
      serviceName: token.serviceName,
      status: token.status,
      issuedAt: token.issuedAt,
      calledAt: token.calledAt,
      servedAt: token.servedAt,
      dateKey: token.dateKey,
      waitMinutes: token.waitMinutes,
      serviceMinutes: token.serviceMinutes,
    })),
  };
}

/** Position + ETA for the signed-in user, polled by the dashboard. */
async function getUserPosition(store, user, serviceId) {
  const service = await requireService(store, serviceId, { activeOnly: false });
  const dateKey = dateKeyFor(new Date(), config.timezone);
  const token = await store.tokens.findActiveByUser(user.id, { serviceId: service.id, dateKey });
  const snapshot = await getQueueSnapshot(store, service, dateKey);

  return {
    dateKey,
    service: serviceSummary(service),
    token: token ? tokenView(token, snapshot) : null,
    queue: serializeSnapshot(snapshot),
  };
}

/** Daily stats + persist the roll-up (report cache). */
async function getDailyStats(store, { service, dateKey }) {
  const tokens = await store.tokens.listByServiceDate(service.id, dateKey);
  const stats = computeDailyStats(tokens, {
    service,
    dateKey,
    timezone: config.timezone,
  });

  try {
    await store.stats.upsertDailyStat({
      serviceId: service.id,
      ...stats,
    });
  } catch (error) {
    console.error('[cloudqueue] failed to cache daily stats', error.message);
  }

  return stats;
}

/** Board for waiting-room screens: one row per active service. */
async function getDisplayBoard(store) {
  const services = await store.services.list();
  const rows = [];

  for (const service of services) {
    const dateKey = dateKeyFor(new Date(), config.timezone);
    const snapshot = await getQueueSnapshot(store, service, dateKey);
    rows.push({
      id: service.id,
      code: service.code,
      name: service.name,
      location: service.location,
      color: service.color,
      serving: snapshot.serving ? snapshot.serving.tokenNumber : null,
      waitingCount: snapshot.waitingCount,
      estimatedWaitMinutes: snapshot.estimatedWaitMinutes,
      averageServiceMinutes: snapshot.averageServiceMinutes,
    });
  }

  return { services: rows, serverTime: new Date().toISOString() };
}

module.exports = {
  requireService,
  getQueueSnapshot,
  serializeSnapshot,
  tokenView,
  serviceSummary,
  positionOf,
  etaFor,
  issueToken,
  callNext,
  completeToken,
  cancelToken,
  getUserOverview,
  getUserPosition,
  getDailyStats,
  getDisplayBoard,
};
