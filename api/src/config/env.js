'use strict';

const path = require('path');

// On Vercel the environment is injected by the platform; locally we read .env.
if (!process.env.VERCEL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
}

const bool = (value) => String(value || '').toLowerCase() === 'true';

const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

const firebaseConfigured = Boolean(
  process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey
);

// Demo mode is explicit when DEMO_MODE is set, otherwise inferred.
// No Firebase credentials => we cannot verify Firebase ID tokens => demo mode.
const demoMode = process.env.DEMO_MODE ? bool(process.env.DEMO_MODE) : !firebaseConfigured;

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isVercel: Boolean(process.env.VERCEL),
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  version: '1.0.0',
  // The daily queue partition must follow the campus clock. Locally we default
  // to the machine's IANA zone so seeds, charts and "today" agree; on Vercel
  // (UTC) set CAMPUS_TIMEZONE explicitly.
  timezone:
    process.env.CAMPUS_TIMEZONE ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC',

  mongoUri: process.env.MONGODB_URI || '',
  useMongo: Boolean(process.env.MONGODB_URI),

  firebase: {
    configured: firebaseConfigured,
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey,
  },

  demoMode,
  // Demo persona logins are always available in demo mode. When Firebase is
  // configured they stay off unless ALLOW_DEMO_LOGIN=true, which is handy for
  // a public graded deployment that should also show the seeded personas.
  demoLoginEnabled: demoMode || bool(process.env.ALLOW_DEMO_LOGIN),
  demoJwtSecret: process.env.DEMO_JWT_SECRET || 'cloudqueue-demo-secret-change-me',
  demoTokenTtl: '12h',

  // Populate the database with the deterministic demo dataset (offices, staff
  // accounts and three days of tokens).
  //   - demo mode            -> on by default, refreshed once per day
  //   - Firebase production  -> off by default, enable with SEED_DEMO_DATA=true
  // Even when this is off, a completely empty database is bootstrapped with the
  // demo dataset so a fresh deployment never renders a blank dashboard.
  seedDemoData: process.env.SEED_DEMO_DATA
    ? bool(process.env.SEED_DEMO_DATA)
    : demoMode,

  superAdminEmails: (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),

  frontendOrigins: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://localhost:4000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
};

if (config.demoMode && config.isProduction && config.demoJwtSecret === 'cloudqueue-demo-secret-change-me') {
  // Loud warning: a public demo with the default secret lets anyone mint a super_admin token.
  console.warn(
    '[cloudqueue] WARNING: DEMO_MODE is enabled in production with the default DEMO_JWT_SECRET.'
  );
}

module.exports = { config };
