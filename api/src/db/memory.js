'use strict';

const crypto = require('crypto');
const { config } = require('../config/env');
const { dateKeyFor } = require('../lib/dateKey');
const { seedActivity } = require('./seed');

/**
 * In-memory adapter.
 *
 * It implements exactly the same repository interface as the MongoDB adapter so
 * the whole application can be run and demoed with zero external accounts
 * (`DEMO_MODE=true` and no MONGODB_URI). Node executes JavaScript on a single
 * thread, which makes the read-modify-write blocks below atomic *within one
 * process*. That is sufficient for a single-instance demo, but it is precisely
 * the guarantee MongoDB provides across many serverless instances - which is
 * why the production path uses findOneAndUpdate / $inc instead.
 */

const newId = () => crypto.randomBytes(12).toString('hex');
const clone = (row) => (row ? { ...row } : null);
const byIssued = (a, b) => a.issuedSequence - b.issuedSequence;
const byCreatedDesc = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

function createMemoryCollections() {
  return {
    users: [],
    services: [],
    tokens: [],
    queueStates: [],
    auditLogs: [],
    dailyStats: [],
  };
}

async function createMemoryStore() {
  const db = createMemoryCollections();
  const users = {
    async findByIdentity(firebaseUid) {
      return clone(db.users.find((user) => user.firebaseUid === firebaseUid));
    },

    async findById(id) {
      return clone(db.users.find((user) => user.id === id));
    },

    async findByEmail(email) {
      const normalized = String(email || '').toLowerCase();
      return clone(db.users.find((user) => user.email === normalized));
    },

    async upsertFromAuth({ firebaseUid, email, displayName, photoUrl }) {
      const normalized = String(email || '').toLowerCase();
      let user = db.users.find((row) => row.firebaseUid === firebaseUid);
      if (!user) user = db.users.find((row) => row.email === normalized);

      if (user) {
        user.firebaseUid = firebaseUid;
        user.email = normalized;
        if (displayName) user.displayName = displayName;
        if (photoUrl) user.photoUrl = photoUrl;
        user.lastLoginAt = new Date();
        user.updatedAt = new Date();
        return clone(user);
      }

      const now = new Date();
      const role = config.superAdminEmails.includes(normalized) ? 'super_admin' : 'user';
      user = {
        id: newId(),
        firebaseUid,
        email: normalized,
        displayName: displayName || normalized.split('@')[0],
        photoUrl: photoUrl || '',
        role,
        isActive: true,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      };
      db.users.push(user);
      return clone(user);
    },

    async updateRole(id, role) {
      const user = db.users.find((row) => row.id === id);
      if (!user) return null;
      user.role = role;
      user.updatedAt = new Date();
      return clone(user);
    },

    async list() {
      return db.users.slice().sort(byCreatedDesc).map(clone);
    },
  };

  const services = {
    async list({ includeInactive = false } = {}) {
      return db.services
        .filter((service) => includeInactive || service.isActive)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(clone);
    },

    async findById(id) {
      return clone(db.services.find((service) => service.id === id));
    },

    async findByCode(code) {
      const normalized = String(code || '').toUpperCase();
      return clone(db.services.find((service) => service.code === normalized));
    },

    async create(data) {
      const now = new Date();
      const service = {
        id: newId(),
        code: String(data.code).toUpperCase(),
        name: data.name,
        description: data.description || '',
        location: data.location || '',
        averageServiceMinutes: data.averageServiceMinutes ?? 5,
        color: data.color || 'indigo',
        isActive: data.isActive ?? true,
        createdBy: data.createdBy || null,
        createdAt: now,
        updatedAt: now,
      };
      db.services.push(service);
      return clone(service);
    },

    async update(id, patch) {
      const service = db.services.find((row) => row.id === id);
      if (!service) return null;
      Object.assign(service, patch, { updatedAt: new Date() });
      return clone(service);
    },

    async remove(id) {
      const index = db.services.findIndex((row) => row.id === id);
      if (index === -1) return false;
      db.services.splice(index, 1);
      return true;
    },

    async countTokens(id) {
      return db.tokens.filter((token) => String(token.serviceId) === id).length;
    },
  };

  const tokens = {
    async create(data) {
      const now = new Date();
      const token = {
        id: newId(),
        status: 'waiting',
        calledAt: null,
        servedAt: null,
        completedAt: null,
        cancelledBy: null,
        notes: '',
        positionAtIssue: 1,
        waitMinutes: null,
        serviceMinutes: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      db.tokens.push(token);
      return clone(token);
    },

    async findById(id) {
      return clone(db.tokens.find((token) => token.id === id));
    },

    async findByIds(ids) {
      const set = new Set(ids.map(String));
      return db.tokens.filter((token) => set.has(token.id)).map(clone);
    },

    async findActiveByUser(userId, { serviceId, dateKey } = {}) {
      const key = dateKey || dateKeyFor(new Date(), config.timezone);
      return (
        db.tokens.find(
          (token) =>
            token.userId === userId &&
            token.dateKey === key &&
            ['waiting', 'serving'].includes(token.status) &&
            (!serviceId || String(token.serviceId) === serviceId)
        ) || null
      );
    },

    async listByUser(userId, { limit = 50, skip = 0 } = {}) {
      return db.tokens
        .filter((token) => token.userId === userId)
        .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
        .slice(skip, skip + limit)
        .map(clone);
    },

    async listWaiting(serviceId, dateKey) {
      return db.tokens
        .filter(
          (token) =>
            String(token.serviceId) === serviceId &&
            token.dateKey === dateKey &&
            token.status === 'waiting'
        )
        .sort(byIssued)
        .map(clone);
    },

    async listByServiceDate(serviceId, dateKey) {
      return db.tokens
        .filter((token) => String(token.serviceId) === serviceId && token.dateKey === dateKey)
        .sort(byIssued)
        .map(clone);
    },

    async listServedRecent(serviceId, dateKey, limit = 8) {
      return db.tokens
        .filter(
          (token) =>
            String(token.serviceId) === serviceId &&
            token.dateKey === dateKey &&
            token.status === 'served' &&
            token.servedAt
        )
        .sort((a, b) => new Date(b.servedAt) - new Date(a.servedAt))
        .slice(0, limit)
        .map(clone);
    },

    async update(id, patch) {
      const token = db.tokens.find((row) => row.id === id);
      if (!token) return null;
      Object.assign(token, patch, { updatedAt: new Date() });
      return clone(token);
    },

    /** Atomic FIFO claim: oldest waiting token becomes the serving token. */
    async claimNext(serviceId, dateKey, now = new Date()) {
      const candidates = db.tokens
        .filter(
          (token) =>
            String(token.serviceId) === serviceId &&
            token.dateKey === dateKey &&
            token.status === 'waiting'
        )
        .sort(byIssued);

      const next = candidates[0];
      if (!next) return null;

      next.status = 'serving';
      next.calledAt = now;
      next.waitMinutes = Math.round(((now - new Date(next.issuedAt)) / 60000) * 10) / 10;
      next.updatedAt = now;
      return clone(next);
    },

    async countByStatus(serviceId, dateKey, status) {
      return db.tokens.filter(
        (token) =>
          String(token.serviceId) === serviceId && token.dateKey === dateKey && token.status === status
      ).length;
    },

    async paginate({ serviceId, dateKey, status, page = 1, limit = 25 } = {}) {
      const filtered = db.tokens
        .filter(
          (token) =>
            token.dateKey === dateKey &&
            (!serviceId || String(token.serviceId) === serviceId) &&
            (!status || token.status === status)
        )
        .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
      const start = (page - 1) * limit;
      return {
        total: filtered.length,
        items: filtered.slice(start, start + limit).map(clone),
      };
    },

    async deleteAllForDate(serviceId, dateKey) {
      for (let i = db.tokens.length - 1; i >= 0; i -= 1) {
        if (String(db.tokens[i].serviceId) === serviceId && db.tokens[i].dateKey === dateKey) {
          db.tokens.splice(i, 1);
        }
      }
    },
  };

  const queue = {
    async nextSequence(serviceId, dateKey) {
      let state = db.queueStates.find(
        (row) => row.serviceId === serviceId && row.dateKey === dateKey
      );
      if (!state) {
        state = {
          id: newId(),
          serviceId,
          dateKey,
          lastIssuedSequence: 0,
          currentServingTokenId: null,
          lastCalledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.queueStates.push(state);
      }
      state.lastIssuedSequence += 1;
      state.updatedAt = new Date();
      return state.lastIssuedSequence;
    },

    async get(serviceId, dateKey) {
      return clone(
        db.queueStates.find((row) => row.serviceId === serviceId && row.dateKey === dateKey)
      );
    },

    async setServing(serviceId, dateKey, tokenId, now = new Date()) {
      let state = db.queueStates.find(
        (row) => row.serviceId === serviceId && row.dateKey === dateKey
      );
      if (!state) {
        state = {
          id: newId(),
          serviceId,
          dateKey,
          lastIssuedSequence: 0,
          currentServingTokenId: null,
          lastCalledAt: null,
          createdAt: now,
          updatedAt: now,
        };
        db.queueStates.push(state);
      }
      state.currentServingTokenId = tokenId;
      state.lastCalledAt = now;
      state.updatedAt = now;
      return clone(state);
    },

    /** Only clear the pointer if it still points at the token we are closing. */
    async clearServingIf(serviceId, dateKey, tokenId) {
      const state = db.queueStates.find(
        (row) => row.serviceId === serviceId && row.dateKey === dateKey
      );
      if (!state) return null;
      if (tokenId && state.currentServingTokenId !== tokenId) return clone(state);
      state.currentServingTokenId = null;
      state.updatedAt = new Date();
      return clone(state);
    },
  };

  const audit = {
    async log(entry) {
      const row = {
        id: newId(),
        createdAt: new Date(),
        ip: '',
        metadata: {},
        ...entry,
      };
      db.auditLogs.push(row);
      return clone(row);
    },

    async list({ limit = 20, action } = {}) {
      return db.auditLogs
        .filter((row) => !action || row.action === action)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(clone);
    },
  };

  const stats = {
    async upsertDailyStat(stat) {
      const existing = db.dailyStats.find(
        (row) => row.serviceId === stat.serviceId && row.dateKey === stat.dateKey
      );
      if (existing) {
        Object.assign(existing, stat, { computedAt: new Date() });
        return clone(existing);
      }
      const row = { id: newId(), createdAt: new Date(), ...stat, computedAt: new Date() };
      db.dailyStats.push(row);
      return clone(row);
    },
  };

  const store = {
    kind: 'memory',
    users,
    services,
    tokens,
    queue,
    audit,
    stats,
    /** Internal handles used by the demo seeder and the smoke tests. */
    _db: db,
    async ping() {
      return true;
    },
    async close() {},
  };

  if (config.demoMode) await seedActivity(store);

  return store;
}

module.exports = { createMemoryStore, newId };
