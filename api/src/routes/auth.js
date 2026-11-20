'use strict';

const crypto = require('crypto');
const express = require('express');
const { config } = require('../config/env');
const { DEMO_CREDENTIALS, findDemoCredential } = require('../config/demoAccounts');
const { getStore } = require('../db');
const { asyncHandler, notFound, unauthorized } = require('../lib/http');
const { requireAuth, signDemoToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { demoLogin } = require('../validation/schemas');
const { recordAudit } = require('../services/audit');
const { DEMO_USERS } = require('../db/seed');

const router = express.Router();

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  photoUrl: user.photoUrl || '',
  createdAt: user.createdAt,
});

/** Constant-time comparison so demo passwords do not leak through timing. */
function passwordMatches(input, expected) {
  const a = crypto.createHash('sha256').update(String(input || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

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
      metadata: { provider: (req.auth && req.auth.provider) || (config.demoMode ? 'demo' : 'firebase') },
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
 * POST /api/auth/demo-login
 * Mints a short-lived HMAC token that mirrors a Firebase ID token's contract.
 * It exists so the project can be demonstrated without a Firebase project; it
 * only answers when demo logins are enabled for this deployment.
 */
router.post(
  '/demo-login',
  authLimiter,
  validate(demoLogin),
  asyncHandler(async (req, res) => {
    if (!config.demoLoginEnabled) {
      throw notFound('Demo sign-in is disabled on this deployment');
    }

    const { email, password, displayName } = req.valid.body;
    const credential = findDemoCredential(email);

    // The two advertised accounts always require their password. In a hybrid
    // (Firebase + demo) deployment they are the only accounts this route
    // accepts; pure demo mode still allows any email for convenience.
    if (credential) {
      if (!passwordMatches(password, credential.password)) {
        throw unauthorized('Incorrect password for this demo account', 'invalid_credentials');
      }
    } else if (!config.demoMode) {
      throw unauthorized(
        'Use one of the demo credentials shown on the sign-in screen',
        'invalid_credentials'
      );
    }

    const store = await getStore();
    let user = await store.users.upsertFromAuth({
      firebaseUid: `demo_${email.replace(/[^a-z0-9]/gi, '_')}`,
      email,
      displayName: (credential && credential.displayName) || displayName || undefined,
    });

    // Keep the seeded role authoritative even if the record already existed.
    if (credential && user.role !== credential.role) {
      user = await store.users.updateRole(user.id, credential.role);
    }

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
    if (!config.demoLoginEnabled) return res.json({ accounts: [], credentials: [] });

    // Always expose the canonical seeded personas (one per role plus the other
    // students) so the sign-in screen is stable even when the shared database
    // contains unrelated or duplicated accounts.
    const store = await getStore();
    const users = await store.users.list();
    const byEmail = new Map(users.map((user) => [user.email, user]));

    res.json({
      accounts: DEMO_USERS.map((demo) => {
        const stored = byEmail.get(demo.email);
        return {
          email: demo.email,
          displayName: (stored && stored.displayName) || demo.displayName,
          role: (stored && stored.role) || demo.role,
        };
      }),
      // Public demo credentials - intentionally exposed so reviewers can sign
      // in. Only returned when demo logins are enabled for this deployment.
      credentials: DEMO_CREDENTIALS.map(({ email, password, displayName, role }) => ({
        email,
        password,
        displayName,
        role,
      })),
    });
  })
);

module.exports = router;
