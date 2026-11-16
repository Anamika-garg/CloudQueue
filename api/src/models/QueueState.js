'use strict';

const mongoose = require('mongoose');

/**
 * One document per service per day. It is the single source of truth for the
 * two values that must never be computed by two concurrent requests:
 *   - lastIssuedSequence (incremented atomically with $inc + upsert)
 *   - currentServingTokenId (the ticket a teller is currently handling)
 */
const queueStateSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    lastIssuedSequence: { type: Number, default: 0, min: 0 },
    currentServingTokenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Token', default: null },
    lastCalledAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

queueStateSchema.index({ serviceId: 1, dateKey: 1 }, { unique: true });

const QueueState = mongoose.models.QueueState || mongoose.model('QueueState', queueStateSchema);

module.exports = QueueState;
