'use strict';

/**
 * Audit logging must never break the user-facing operation, so failures are
 * swallowed after being reported to the platform logs.
 */
async function recordAudit(store, req, action, { target, serviceId, metadata } = {}) {
  try {
    await store.audit.log({
      action,
      performedBy: {
        userId: req.user ? req.user.id : null,
        email: req.user ? req.user.email : 'system',
        role: req.user ? req.user.role : 'system',
      },
      target: {
        type: (target && target.type) || '',
        id: (target && target.id) || null,
        label: (target && target.label) || '',
      },
      serviceId: serviceId || null,
      metadata: metadata || {},
      ip: req.ip || '',
    });
  } catch (error) {
    console.error('[cloudqueue] failed to write audit log', action, error.message);
  }
}

module.exports = { recordAudit };
