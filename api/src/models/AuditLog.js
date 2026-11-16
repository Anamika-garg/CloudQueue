'use strict';

const mongoose = require('mongoose');

const ACTIONS = [
  'queue.call_next',
  'queue.mark_served',
  'queue.mark_no_show',
  'queue.clear',
  'token.issue',
  'token.cancel',
  'service.create',
  'service.update',
  'service.delete',
  'auth.sync',
  'auth.demo_login',
  'user.role_update',
];

/**
 * Append-only audit trail for privileged actions. Written by the admin routes
 * and never exposed to the `user` role.
 */
const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, enum: ACTIONS, index: true },
    performedBy: {
      userId: { type: String, default: null },
      email: { type: String, default: '' },
      role: { type: String, default: '' },
    },
    target: {
      type: { type: String, default: '' },
      id: { type: String, default: null },
      label: { type: String, default: '' },
    },
    serviceId: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
module.exports.ACTIONS = ACTIONS;
