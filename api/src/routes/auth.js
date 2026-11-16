'use strict';

const express = require('express');
const { config } = require('../config/env');
const { getStore } = require('../db');
const { asyncHandler, notFound } = require('../lib/http');
const { requireAuth, signDemoToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { demoLogin } = require('../validation/schemas');
const { recordAudit } = require('../services/audit');

const router = express.Router();

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  photoUrl: user.photoUrl || '',
  createdAt: user.createdAt,
});

/**
 * POST /api/auth/sync
 * Called by the SPA right after Firebase sign-in. requireAuth already
 * provisions/updates the user record, so this endpoint simply returns the
 * authoritative profile (including the role) and records the sign-in.
 */
router.post(
  '/sync',
  requireAuth,
  asyncHandler(async (req, res) => {
    await recordAudit(req.store, req, 'auth.sync', {
      target: { type: 'user', id: req.user.id, label: req.user.email },
      metadata: { provider: config.demoMode ? 'demo' : 'firebase' },
    });

    res.json({
      user: publicUser(req.user),
      role: req.user.role,
      mode: config.demoMode ? 'demo' : 'firebase',
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user), mode: config.demoMode ? 'demo' : 'firebase' });
  })
);

/**
 * POST /api/auth/demo-login  (demo mode only)
 * Mints a short-lived HMAC token that mirrors a Firebase ID token's contract.
 * It exists so the project can be demonstrated without a Firebase project;
 * in production this route returns 404 and only Firebase tokens are accepted.
 */
router.post(
  '/demo-login',
  authLimiter,
  validate(demoLogin),
  asyncHandler(async (req, res) => {
    if (!config.demoMode) {
      throw notFound('Demo sign-in is disabled on this deployment');
    }

    const { email, displayName } = req.valid.body;
    const store = await getStore();
    const user = await store.users.upsertFromAuth({
      firebaseUid: `demo_${email.replace(/[^a-z0-9]/gi, '_')}`,
      email,
      displayName: displayName || undefined,
    });

    const token = signDemoToken({ email: user.email, displayName: user.displayName });
    req.user = user;

    await recordAudit(store, req, 'auth.demo_login', {
      target: { type: 'user', id: user.id, label: user.email },
      metadata: { role: user.role },
    });

    res.json({
      token,
      expiresIn: config.demoTokenTtl,
      user: publicUser(user),
      mode: 'demo',
    });
  })
);

/** GET /api/auth/demo-accounts - convenience list for the demo login screen. */
router.get(
  '/demo-accounts',
  asyncHandler(async (req, res) => {
    if (!config.demoMode) return res.json({ accounts: [] });
    const store = await getStore();
    const users = await store.users.list();
    res.json({
      accounts: users
        .slice()
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .filter((user) => ['admin', 'super_admin'].includes(user.role) || user.role === 'user')
        .slice(0, 8)
        .map((user) => ({
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        })),
    });
  })
);

module.exports = router;
