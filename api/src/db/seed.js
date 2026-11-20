'use strict';

const { config } = require('../config/env');
const { DEMO_CREDENTIALS } = require('../config/demoAccounts');
const { dateKeyFor } = require('../lib/dateKey');

/**
 * Demo seed.
 *
 * Produces a believable campus day - four offices, ~90 tokens spread over the
 * last three days, one token currently being served per office and a couple
 * waiting - so the dashboards, charts and display board are populated the
 * moment the app boots. The same routine powers `npm run seed` against MongoDB
 * Atlas and the automatic bootstrap of a production deployment.
 *
 * The seed is idempotent: before writing it clears the demo services' tokens and
 * queue counters for the three-day window, so restarting never doubles the data
 * or shifts token numbers.
 */

const DEMO_USERS = [
  { email: 'student@campus.edu', displayName: 'Aarav Sharma', role: 'user' },
  { email: 'fatima@campus.edu', displayName: 'Fatima Bello', role: 'user' },
  { email: 'marcus@campus.edu', displayName: 'Marcus Reed', role: 'user' },
  { email: 'lena@campus.edu', displayName: 'Lena Ortiz', role: 'user' },
  { email: 'yusuf@campus.edu', displayName: 'Yusuf Demir', role: 'user' },
  { email: 'admin@campus.edu', displayName: 'Priya Nair', role: 'admin' },
  { email: 'super@campus.edu', displayName: 'Daniel Osei', role: 'super_admin' },
];

// The password-protected accounts are seeded exactly like the other personas,
// so signing in with them immediately shows the same history and dashboards.
const SEED_USERS = [
  ...DEMO_USERS,
  ...DEMO_CREDENTIALS.map(({ password, ...account }) => account),
];

/** Students whose personal history is populated (never a live token). */
const HISTORY_EMAILS = ['student@campus.edu', 'student@edu.ac.in'];

const DEMO_SERVICES = [
  {
    code: 'REG',
    name: 'Registrar',
    description: 'Enrolment letters, transcripts, course changes and student records.',
    location: 'Admin Block, Room 104',
    averageServiceMinutes: 6,
    color: 'indigo',
    dailyVolume: 24,
  },
  {
    code: 'CLN',
    name: 'Campus Clinic',
    description: 'Consultations, sick notes, vaccinations and basic diagnostics.',
    location: 'Health Centre, Ground Floor',
    averageServiceMinutes: 8,
    color: 'emerald',
    dailyVolume: 17,
  },
  {
    code: 'LIB',
    name: 'Library Services',
    description: 'Book loans, research assistance and printing account support.',
    location: 'Main Library, Level 2',
    averageServiceMinutes: 4,
    color: 'amber',
    dailyVolume: 13,
  },
  {
    code: 'BUR',
    name: 'Bursary',
    description: 'Fee statements, payment plans, refunds and scholarship queries.',
    location: 'Finance Block, Room 12',
    averageServiceMinutes: 7,
    color: 'rose',
    dailyVolume: 15,
  },
];

/** Deterministic PRNG so every boot looks the same (nice for screenshots). */
function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad3 = (value) => String(value).padStart(3, '0');

async function seedActivity(store) {
  const now = new Date();
  const todayKey = dateKeyFor(now, config.timezone);
  const random = mulberry32(20261116);

  // 1. Users ---------------------------------------------------------------
  const users = {};
  for (const demo of SEED_USERS) {
    const user = await store.users.upsertFromAuth({
      firebaseUid: `demo_${demo.email.replace(/[^a-z0-9]/gi, '_')}`,
      email: demo.email,
      displayName: demo.displayName,
    });
    if (user.role !== demo.role) {
      users[demo.email] = await store.users.updateRole(user.id, demo.role);
    } else {
      users[demo.email] = user;
    }
  }

  // 2. Services ------------------------------------------------------------
  const services = {};
  for (const demo of DEMO_SERVICES) {
    const existing = await store.services.findByCode(demo.code);
    const { dailyVolume, ...serviceFields } = demo;
    services[demo.code] =
      existing ||
      (await store.services.create({
        ...serviceFields,
        createdBy: 'seed',
      }));
  }

  const students = SEED_USERS.filter((user) => user.role === 'user').map((user) => users[user.email]);
  const historyStudents = HISTORY_EMAILS.map((email) => users[email]).filter(Boolean);
  const historyIds = new Set(historyStudents.map((student) => student.id));
  if (!students.length || !historyStudents.length) throw new Error('Seed users missing');

  // 3. Build timestamps, grouped by service + campus day --------------------
  const groups = new Map();

  for (const demo of DEMO_SERVICES) {
    const service = services[demo.code];
    for (let dayOffset = 0; dayOffset < 3; dayOffset += 1) {
      const volume = Math.max(
        6,
        Math.round(demo.dailyVolume * (0.75 + random() * 0.5) - dayOffset * 2)
      );
      for (let i = 0; i < volume; i += 1) {
        // Spread over roughly the last 7 hours of that day.
        const minutesBack = 6 + random() * 410;
        const issuedAt = new Date(
          now.getTime() - dayOffset * 86400000 - minutesBack * 60000
        );
        const dateKey = dateKeyFor(issuedAt, config.timezone);
        const key = `${demo.code}:${dateKey}`;
        if (!groups.has(key)) groups.set(key, { service, dateKey, rows: [] });
        groups.get(key).rows.push({ issuedAt, service });
      }
    }
  }

  // 4. Materialise tokens ---------------------------------------------------
  // Everything is built in memory first and written with a couple of bulk
  // operations. That keeps the seeder fast enough to run inside a serverless
  // request (Vercel functions have a hard duration limit).
  const documents = [];
  const dailyStates = [];

  for (const group of groups.values()) {
    const rows = group.rows.sort((a, b) => a.issuedAt - b.issuedAt);
    const isToday = group.dateKey === todayKey;
    const liveCount = isToday ? Math.min(3, rows.length) : 0;
    const firstLiveIndex = rows.length - liveCount;
    let servingNumber = null;
    let servingCalledAt = null;

    for (let index = 0; index < rows.length; index += 1) {
      const sequence = index + 1;
      const tokenNumber = `${group.service.code}-${pad3(sequence)}`;

      // Give the demo students a realistic personal history, but never a live
      // token, so the "Get Token" walkthrough is never blocked.
      const isHistorySlot =
        isToday && index < Math.max(0, firstLiveIndex - 2) && index % 5 === 0;
      // Live line entries never belong to the history students, so the
      // walkthrough always starts from a clean slate.
      const pool =
        index >= firstLiveIndex
          ? students.filter((student) => !historyIds.has(student.id))
          : students;
      const student = isHistorySlot
        ? historyStudents[(index / 5) % historyStudents.length]
        : pool[Math.floor(random() * pool.length)] || historyStudents[0];

      const status = (() => {
        if (index >= firstLiveIndex && liveCount > 0) {
          if (index === firstLiveIndex) return 'serving';
          return 'waiting';
        }
        const roll = random();
        if (roll < 0.08) return 'no_show';
        if (roll < 0.17) return 'cancelled';
        return 'served';
      })();

      const waitMinutes = Math.round((4 + random() * 24) * 10) / 10;
      const serviceMinutes = Math.round(
        (Math.max(2, group.service.averageServiceMinutes - 3) + random() * 6) * 10
      ) / 10;

      let calledAt = null;
      let servedAt = null;
      let completedAt = null;

      if (status === 'serving') {
        calledAt = new Date(now.getTime() - (1 + random() * 4) * 60000);
        servingNumber = tokenNumber;
        servingCalledAt = calledAt;
      } else if (status === 'served' || status === 'no_show') {
        calledAt = new Date(rows[index].issuedAt.getTime() + waitMinutes * 60000);
        if (calledAt > now) calledAt = new Date(now.getTime() - 5 * 60000);
        if (status === 'served') {
          servedAt = new Date(Math.min(now.getTime(), calledAt.getTime() + serviceMinutes * 60000));
        }
        completedAt = servedAt || new Date(Math.min(now.getTime(), calledAt.getTime() + 60000));
      } else if (status === 'cancelled') {
        completedAt = new Date(
          Math.min(now.getTime(), rows[index].issuedAt.getTime() + (1 + random() * 8) * 60000)
        );
      }

      // Keep the persisted durations consistent with the timestamps so charts
      // and the history table tell the same story.
      const actualWait =
        calledAt && calledAt > rows[index].issuedAt
          ? Math.round(((calledAt - rows[index].issuedAt) / 60000) * 10) / 10
          : null;
      const actualService =
        servedAt && calledAt
          ? Math.round(((servedAt - calledAt) / 60000) * 10) / 10
          : null;

      documents.push({
        tokenNumber,
        serviceId: group.service.id,
        serviceCode: group.service.code,
        serviceName: group.service.name,
        userId: student.id,
        userEmail: student.email,
        userDisplayName: student.displayName,
        status,
        issuedSequence: sequence,
        issuedAt: rows[index].issuedAt,
        calledAt: calledAt && calledAt > rows[index].issuedAt ? calledAt : null,
        servedAt,
        completedAt,
        dateKey: group.dateKey,
        positionAtIssue: index + 1,
        waitMinutes: actualWait,
        serviceMinutes: actualService,
        cancelledBy: status === 'cancelled' ? 'user' : null,
      });
    }

    dailyStates.push({
      service: group.service,
      dateKey: group.dateKey,
      lastIssuedSequence: rows.length,
      servingNumber,
      servingCalledAt,
    });
  }

  // 5. Reset the demo window, then bulk insert ------------------------------
  const serviceIds = [...new Set(dailyStates.map((state) => state.service.id))];
  const dateKeys = [...new Set(dailyStates.map((state) => state.dateKey))];

  await store.tokens.deleteByServiceDates(serviceIds, dateKeys);
  await store.queue.reset(serviceIds, dateKeys);

  const inserted = await store.tokens.createMany(documents);
  const byNumber = new Map(
    inserted.map((token) => [`${token.serviceCode}:${token.dateKey}:${token.tokenNumber}`, token])
  );

  for (const state of dailyStates) {
    const serving = state.servingNumber
      ? byNumber.get(`${state.service.code}:${state.dateKey}:${state.servingNumber}`)
      : null;
    await store.queue.setState(state.service.id, state.dateKey, {
      lastIssuedSequence: state.lastIssuedSequence,
      currentServingTokenId: serving ? serving.id : null,
      lastCalledAt: serving ? state.servingCalledAt : null,
    });
  }

  await store.audit.log({
    action: 'dataset.seed',
    performedBy: { userId: 'seed', email: 'system@cloudqueue', role: 'super_admin' },
    target: { type: 'seed', id: null, label: 'Demo dataset' },
    metadata: {
      dateKey: todayKey,
      services: Object.keys(services).length,
      tokens: inserted.length,
    },
  });

  return {
    users: Object.keys(users).length,
    services: Object.keys(services).length,
    tokens: inserted.length,
    dateKey: todayKey,
  };
}

/**
 * Seeds the demo dataset at most once per campus day.
 *
 * - In demo mode / when SEED_DEMO_DATA=true the data is refreshed daily.
 * - Otherwise an empty deployment is bootstrapped once so it never looks broken.
 * - `store.seeds.claim` is an atomic lock, so parallel serverless instances do
 *   not seed at the same time.
 */
async function ensureDemoDataset(store, { force = config.seedDemoData } = {}) {
  const todayKey = dateKeyFor(new Date(), config.timezone);

  if (!force) {
    const services = await store.services.list({ includeInactive: true });
    if (services.length) return { skipped: true, reason: 'database already initialised' };
  }

  const claimed = await store.seeds.claim(todayKey);
  if (!claimed) return { skipped: true, reason: 'already seeded today' };

  try {
    const result = await seedActivity(store);
    await store.seeds.complete(todayKey, result);
    return result;
  } catch (error) {
    await store.seeds.release(todayKey);
    throw error;
  }
}

module.exports = { seedActivity, ensureDemoDataset, DEMO_USERS, DEMO_SERVICES };
