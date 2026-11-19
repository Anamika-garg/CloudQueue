'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const { getStore } = require('../db');
const { AppError, unauthorized, forbidden } = require('../lib/http');

/**
 * Authentication & RBAC
 * ---------------------
 * 1. The bearer token is verified cryptographically (Firebase Admin SDK in
 *    production, a short-lived HMAC-signed demo token otherwise).
 * 2. The user record - and therefore the role - is always loaded from the
 *    database. Role claims on the wire are never trusted.
 * 3. requireRole() gates the admin surface.
 */

const ROLE_LEVEL = { user: 1, admin: 2, super_admin: 3 };

let firebaseAuth = null;

function getFirebaseAuth() {
  if (!config.firebase.configured) {
    throw new AppError(500, 'firebase_not_configured', 'Firebase Admin SDK is not configured');
  }
  if (!firebaseAuth) {
    // Lazily initialised so demo mode never touches the SDK.
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      });
    }
    firebaseAuth = admin.auth();
  }
  return firebaseAuth;
}

function demoUidFor(email) {
  return `demo_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 20)}`;
}

function signDemoToken({ email, displayName }) {
  const normalized = String(email).toLowerCase();
  return jwt.sign(
    { sub: demoUidFor(normalized), email: normalized, name: displayName || '' },
    config.demoJwtSecret,
    { expiresIn: config.demoTokenTtl, issuer: 'cloudqueue-demo', audience: 'cloudqueue-api' }
  );
}

function verifyDemoToken(token) {
  try {
    const payload = jwt.verify(token, config.demoJwtSecret, {
      issuer: 'cloudqueue-demo',
      audience: 'cloudqueue-api',
    });
    return {
      uid: payload.sub,
      email: payload.email,
      name: payload.name || '',
      provider: 'demo',
    };
  } catch (error) {
    throw unauthorized('Session token is invalid or has expired', 'invalid_token');
  }
}

/** Demo tokens carry our own issuer claim, so we can route them without guessing. */
function isDemoToken(token) {
  const payload = jwt.decode(token);
  return Boolean(payload && payload.iss === 'cloudqueue-demo');
}

async function verifyFirebaseToken(token) {
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token, true);
    if (!decoded.email) {
      throw unauthorized('The identity provider did not return an email address', 'missing_email');
    }
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || '',
      picture: decoded.picture,
      provider: 'firebase',
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unauthorized('Firebase ID token is invalid or has expired', 'invalid_token');
  }
}

function readBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    throw unauthorized('Missing Authorization: Bearer <token> header', 'missing_token');
  }
  return token;
}

/**
 * Verifies the token and attaches `req.user` (database record) + `req.auth`
 * (provider identity). Users are provisioned on first contact, so a valid
 * Firebase token is enough to be recognised - no separate registration step.
 */
async function requireAuth(req, res, next) {
  try {
    const token = readBearerToken(req);
    let identity;
    if (config.demoMode) {
      identity = verifyDemoToken(token);
    } else if (config.demoLoginEnabled && isDemoToken(token)) {
      // Hybrid deployment: Firebase for real accounts, HMAC demo personas too.
      identity = verifyDemoToken(token);
    } else {
      identity = await verifyFirebaseToken(token);
    }

    const store = await getStore();
    const user = await store.users.upsertFromAuth({
      firebaseUid: identity.uid,
      email: identity.email,
      displayName: identity.name,
      photoUrl: identity.picture,
    });

    if (!user || user.isActive === false) {
      throw forbidden('This account has been disabled');
    }

    req.user = user;
    req.auth = identity;
    next();
  } catch (error) {
    next(error);
  }
}

/** Attaches req.user when a valid token is present, but never rejects. */
async function optionalAuth(req, res, next) {
  const header = req.get('authorization') || '';
  if (!header) return next();
  return requireAuth(req, res, next);
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        forbidden(
          `This action requires the ${allowedRoles.join(' or ')} role (your role: ${req.user.role})`
        )
      );
    }
    return next();
  };
}

/** super_admin >= admin >= user, for endpoints that allow "at least" a level. */
function requireAtLeast(role) {
  const minimum = ROLE_LEVEL[role] || 99;
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if ((ROLE_LEVEL[req.user.role] || 0) < minimum) return next(forbidden());
    return next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requireAtLeast,
  signDemoToken,
  demoUidFor,
  ROLE_LEVEL,
};
