'use strict';

const mongoose = require('mongoose');

const TOKEN_STATUS = ['waiting', 'serving', 'served', 'cancelled', 'no_show'];

const tokenSchema = new mongoose.Schema(
  {
    tokenNumber: { type: String, required: true, trim: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    // Denormalised so the admin history table and audit trail do not need lookups.
    serviceCode: { type: String, required: true, uppercase: true },
    serviceName: { type: String, default: '' },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userEmail: { type: String, default: '', lowercase: true },
    userDisplayName: { type: String, default: '' },

    status: { type: String, enum: TOKEN_STATUS, default: 'waiting' },

    // Monotonic per (service, dateKey) - the FIFO ordering key.
    issuedSequence: { type: Number, required: true, min: 1 },
    issuedAt: { type: Date, required: true, default: Date.now },
    calledAt: { type: Date, default: null },
    servedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },

    // Audit snapshot at the moment of issue.
    positionAtIssue: { type: Number, default: 1, min: 1 },

    // Derived durations, persisted once so analytics stay cheap.
    waitMinutes: { type: Number, default: null },
    serviceMinutes: { type: Number, default: null },

    cancelledBy: { type: String, enum: ['user', 'admin'], default: null },
    notes: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true, versionKey: false }
);

// Unique token number per service per day (e.g. REG-014 on 2026-11-16).
tokenSchema.index({ serviceId: 1, dateKey: 1, tokenNumber: 1 }, { unique: true });
// Hot path: "who is waiting, oldest first" for call-next.
tokenSchema.index({ serviceId: 1, dateKey: 1, status: 1, issuedSequence: 1 });
// User history + active token lookup.
tokenSchema.index({ userId: 1, dateKey: -1 });
tokenSchema.index({ userId: 1, status: 1 });
// Admin history pagination.
tokenSchema.index({ dateKey: -1, serviceId: 1, issuedAt: -1 });

const Token = mongoose.models.Token || mongoose.model('Token', tokenSchema);

module.exports = Token;
module.exports.TOKEN_STATUS = TOKEN_STATUS;
