'use strict';

const mongoose = require('mongoose');
const { config } = require('../config/env');

const User = require('../models/User');
const Service = require('../models/Service');
const Token = require('../models/Token');
const QueueState = require('../models/QueueState');
const AuditLog = require('../models/AuditLog');
const DailyStat = require('../models/DailyStat');

/**
 * MongoDB Atlas adapter - the production path.
 *
 * Concurrency guarantees used here:
 *   - queue.nextSequence  : one atomic $inc + upsert per (service, dateKey).
 *   - tokens.claimNext    : findOneAndUpdate with sort, so two tellers pressing
 *                           "Call next" simultaneously can never receive the
 *                           same token (the second call either gets the next
 *                           ticket or no document at all).
 *   - queue.setServing    : only ever points at a token that exists.
 */

const asId = (value) => (value ? String(value) : null);

function serializeUser(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    firebaseUid: obj.firebaseUid,
    email: obj.email,
    displayName: obj.displayName || '',
    role: obj.role,
    photoUrl: obj.photoUrl || '',
    isActive: obj.isActive !== false,
    lastLoginAt: obj.lastLoginAt || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function serializeService(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    code: obj.code,
    name: obj.name,
    description: obj.description || '',
    location: obj.location || '',
    averageServiceMinutes: obj.averageServiceMinutes,
    color: obj.color || 'indigo',
    isActive: obj.isActive !== false,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function serializeToken(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    tokenNumber: obj.tokenNumber,
    serviceId: asId(obj.serviceId),
    serviceCode: obj.serviceCode,
    serviceName: obj.serviceName || '',
    userId: asId(obj.userId),
    userEmail: obj.userEmail || '',
    userDisplayName: obj.userDisplayName || '',
    status: obj.status,
    issuedSequence: obj.issuedSequence,
    issuedAt: obj.issuedAt,
    calledAt: obj.calledAt || null,
    servedAt: obj.servedAt || null,
    completedAt: obj.completedAt || null,
    dateKey: obj.dateKey,
    positionAtIssue: obj.positionAtIssue,
    waitMinutes: obj.waitMinutes ?? null,
    serviceMinutes: obj.serviceMinutes ?? null,
    cancelledBy: obj.cancelledBy || null,
    notes: obj.notes || '',
    createdAt: obj.createdAt,
  };
}

function serializeAudit(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    action: obj.action,
    performedBy: obj.performedBy,
    target: obj.target,
    serviceId: obj.serviceId || null,
    metadata: obj.metadata || {},
    createdAt: obj.createdAt,
  };
}

let connectionPromise = null;

function connect() {
  if (!connectionPromise) {
    mongoose.set('strictQuery', true);
    connectionPromise = mongoose
      .connect(config.mongoUri, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
        // Serverless: keep the pool small, let the platform fan out.
        minPoolSize: 0,
      })
      .then(() => {
        console.log('[cloudqueue] connected to MongoDB Atlas');
        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }
  return connectionPromise;
}

async function createMongoStore() {
  await connect();

  const users = {
    async findByIdentity(firebaseUid) {
      return serializeUser(await User.findOne({ firebaseUid }).lean());
    },
    async findById(id) {
      return serializeUser(await User.findById(id).lean());
    },
    async findByEmail(email) {
      return serializeUser(await User.findOne({ email: String(email).toLowerCase() }).lean());
    },
    async upsertFromAuth({ firebaseUid, email, displayName, photoUrl }) {
      const normalized = String(email || '').toLowerCase();
      const existing = await User.findOne({
        $or: [{ firebaseUid }, { email: normalized }],
      });
      if (existing) {
        existing.firebaseUid = firebaseUid;
        existing.email = normalized;
        if (displayName) existing.displayName = displayName;
        if (photoUrl) existing.photoUrl = photoUrl;
        existing.lastLoginAt = new Date();
        await existing.save();
        return serializeUser(existing);
      }
      const role = config.superAdminEmails.includes(normalized) ? 'super_admin' : 'user';
      try {
        const created = await User.create({
          firebaseUid,
          email: normalized,
          displayName: displayName || normalized.split('@')[0],
          photoUrl: photoUrl || '',
          role,
          lastLoginAt: new Date(),
        });
        return serializeUser(created);
      } catch (error) {
        if (error && error.code === 11000) {
          // Lost a race with a parallel sign-in: read the winner.
          return serializeUser(
            await User.findOne({ $or: [{ firebaseUid }, { email: normalized }] }).lean()
          );
        }
        throw error;
      }
    },
    async updateRole(id, role) {
      return serializeUser(await User.findByIdAndUpdate(id, { role }, { new: true }).lean());
    },
    async list() {
      return (await User.find().sort({ createdAt: -1 }).limit(200).lean()).map(serializeUser);
    },
  };

  const services = {
    async list({ includeInactive = false } = {}) {
      const filter = includeInactive ? {} : { isActive: true };
      return (await Service.find(filter).sort({ name: 1 }).lean()).map(serializeService);
    },
    async findById(id) {
      return serializeService(await Service.findById(id).lean());
    },
    async findByCode(code) {
      return serializeService(await Service.findOne({ code: String(code).toUpperCase() }).lean());
    },
    async create(data) {
      return serializeService(await Service.create(data));
    },
    async update(id, patch) {
      return serializeService(await Service.findByIdAndUpdate(id, patch, { new: true }).lean());
    },
    async remove(id) {
      const result = await Service.deleteOne({ _id: id });
      return result.deletedCount > 0;
    },
    async countTokens(id) {
      return Token.countDocuments({ serviceId: id });
    },
  };

  const tokens = {
    async create(data) {
      return serializeToken(await Token.create(data));
    },
    async findById(id) {
      return serializeToken(await Token.findById(id).lean());
    },
    async findByIds(ids) {
      return (await Token.find({ _id: { $in: ids } }).lean()).map(serializeToken);
    },
    async findActiveByUser(userId, { serviceId, dateKey } = {}) {
      const filter = {
        userId,
        status: { $in: ['waiting', 'serving'] },
      };
      if (dateKey) filter.dateKey = dateKey;
      if (serviceId) filter.serviceId = serviceId;
      return serializeToken(await Token.findOne(filter).sort({ issuedAt: 1 }).lean());
    },
    async listByUser(userId, { limit = 50, skip = 0 } = {}) {
      return (
        await Token.find({ userId }).sort({ issuedAt: -1 }).skip(skip).limit(limit).lean()
      ).map(serializeToken);
    },
    async listWaiting(serviceId, dateKey) {
      return (
        await Token.find({ serviceId, dateKey, status: 'waiting' })
          .sort({ issuedSequence: 1 })
          .lean()
      ).map(serializeToken);
    },
    async listByServiceDate(serviceId, dateKey) {
      return (
        await Token.find({ serviceId, dateKey }).sort({ issuedSequence: 1 }).lean()
      ).map(serializeToken);
    },
    async listServedRecent(serviceId, dateKey, limit = 8) {
      return (
        await Token.find({ serviceId, dateKey, status: 'served', servedAt: { $ne: null } })
          .sort({ servedAt: -1 })
          .limit(limit)
          .lean()
      ).map(serializeToken);
    },
    async update(id, patch) {
      return serializeToken(await Token.findByIdAndUpdate(id, patch, { new: true }).lean());
    },
    async claimNext(serviceId, dateKey, now = new Date()) {
      const claimed = await Token.findOneAndUpdate(
        { serviceId, dateKey, status: 'waiting' },
        { $set: { status: 'serving', calledAt: now } },
        { sort: { issuedSequence: 1 }, new: true }
      ).lean();

      if (!claimed) return null;

      const waitMinutes =
        Math.round(((now.getTime() - new Date(claimed.issuedAt).getTime()) / 60000) * 10) / 10;

      await Token.updateOne({ _id: claimed._id }, { $set: { waitMinutes: Math.max(0, waitMinutes) } });
      return serializeToken({ ...claimed, waitMinutes: Math.max(0, waitMinutes) });
    },
    async countByStatus(serviceId, dateKey, status) {
      return Token.countDocuments({ serviceId, dateKey, status });
    },
    async paginate({ serviceId, dateKey, status, page = 1, limit = 25 } = {}) {
      const filter = { dateKey };
      if (serviceId) filter.serviceId = serviceId;
      if (status) filter.status = status;

      const [items, total] = await Promise.all([
        Token.find(filter)
          .sort({ issuedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Token.countDocuments(filter),
      ]);

      return { total, items: items.map(serializeToken) };
    },
    async deleteAllForDate(serviceId, dateKey) {
      await Token.deleteMany({ serviceId, dateKey });
    },
  };

  const queue = {
    async nextSequence(serviceId, dateKey) {
      const apply = () =>
        QueueState.findOneAndUpdate(
          { serviceId, dateKey },
          { $inc: { lastIssuedSequence: 1 }, $setOnInsert: { currentServingTokenId: null } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        ).lean();

      let state;
      try {
        state = await apply();
      } catch (error) {
        // Two concurrent upserts of the same (serviceId, dateKey) can race on the
        // unique index. The retry now updates the document that won.
        if (error && error.code === 11000) state = await apply();
        else throw error;
      }
      return state.lastIssuedSequence;
    },

    async get(serviceId, dateKey) {
      const state = await QueueState.findOne({ serviceId, dateKey }).lean();
      if (!state) return null;
      return {
        id: String(state._id),
        serviceId: asId(state.serviceId),
        dateKey: state.dateKey,
        lastIssuedSequence: state.lastIssuedSequence,
        currentServingTokenId: asId(state.currentServingTokenId),
        lastCalledAt: state.lastCalledAt || null,
        updatedAt: state.updatedAt,
      };
    },

    async setServing(serviceId, dateKey, tokenId, now = new Date()) {
      const state = await QueueState.findOneAndUpdate(
        { serviceId, dateKey },
        { $set: { currentServingTokenId: tokenId, lastCalledAt: now } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
      return state && {
        id: String(state._id),
        currentServingTokenId: asId(state.currentServingTokenId),
        lastCalledAt: state.lastCalledAt,
      };
    },

    async clearServingIf(serviceId, dateKey, tokenId) {
      const filter = { serviceId, dateKey };
      if (tokenId) filter.currentServingTokenId = tokenId;
      const state = await QueueState.findOneAndUpdate(
        filter,
        { $set: { currentServingTokenId: null } },
        { new: true }
      ).lean();
      return state
        ? { id: String(state._id), currentServingTokenId: asId(state.currentServingTokenId) }
        : null;
    },
  };

  const audit = {
    async log(entry) {
      return serializeAudit(await AuditLog.create(entry));
    },
    async list({ limit = 20, action } = {}) {
      const filter = action ? { action } : {};
      return (
        await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
      ).map(serializeAudit);
    },
  };

  const stats = {
    async upsertDailyStat(stat) {
      const doc = await DailyStat.findOneAndUpdate(
        { serviceId: stat.serviceId, dateKey: stat.dateKey },
        { $set: { ...stat, computedAt: new Date() } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean();
      return { ...doc, id: String(doc._id) };
    },
  };

  return {
    kind: 'mongo',
    users,
    services,
    tokens,
    queue,
    audit,
    stats,
    async ping() {
      return mongoose.connection.readyState === 1;
    },
    async close() {
      await mongoose.disconnect();
      connectionPromise = null;
    },
  };
}

module.exports = { createMongoStore };
