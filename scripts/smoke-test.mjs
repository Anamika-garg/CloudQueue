#!/usr/bin/env node
/**
 * CloudQueue end-to-end smoke test.
 *
 * Boots the real Express app in demo mode (in-memory store), then exercises the
 * public API exactly like the SPA does: auth, RBAC, token issue, atomic
 * concurrency, call-next, mark-served, cancel, stats, history, audit, board.
 *
 *   npm test
 *
 * Exit code 0 = all assertions passed.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

process.env.DEMO_MODE = 'true';
process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';

const { createApp } = require('../api/src/app.js');

const app = createApp();
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
const failures = [];

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${extra ? ` → ${JSON.stringify(extra)}` : ''}`);
  }
}

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { status: response.status, body: payload };
}

const login = async (email) => {
  const result = await call('/api/auth/demo-login', { method: 'POST', body: { email } });
  return { token: result.body.token, user: result.body.user, status: result.status };
};

console.log('\nCloudQueue smoke test\n=====================');

// 1. Public surface ---------------------------------------------------------
const health = await call('/api/health');
check('health returns ok', health.status === 200 && health.body.status === 'ok', health.body);
check('health reports demo auth', health.body.authMode === 'demo');
check('health reports in-memory db', health.body.database === 'memory');

const servicesRes = await call('/api/services');
const services = servicesRes.body.services || [];
check('public services list', servicesRes.status === 200 && services.length >= 4, servicesRes.body);
check(
  'services are seeded with codes',
  ['REG', 'CLN', 'LIB', 'BUR'].every((code) => services.some((s) => s.code === code))
);

const board = await call('/api/queue/board');
check('public display board', board.status === 200 && board.body.services.length === services.length);

// 2. Authentication ---------------------------------------------------------
const missing = await call('/api/tokens/my');
check('protected route rejects anonymous', missing.status === 401, missing.body);

const bad = await call('/api/tokens/my', { token: 'not-a-real-token' });
check('protected route rejects bad token', bad.status === 401);

const student = await login('student@campus.edu');
const admin = await login('admin@campus.edu');
const superAdmin = await login('super@campus.edu');
check('demo login returns user + role', student.user.role === 'user' && Boolean(student.token));
check('admin role resolved', admin.user.role === 'admin');
check('super_admin role resolved', superAdmin.user.role === 'super_admin');

const synced = await call('/api/auth/sync', { method: 'POST', token: student.token });
check('auth sync returns profile', synced.status === 200 && synced.body.user.email === 'student@campus.edu');

// 3. RBAC -------------------------------------------------------------------
check(
  'student blocked from admin stats',
  (await call('/api/admin/stats', { token: student.token })).status === 403
);
check(
  'admin allowed on admin stats',
  (await call('/api/admin/stats', { token: admin.token })).status === 200
);
check(
  'admin blocked from service creation',
  (await call('/api/services', { method: 'POST', token: admin.token, body: { code: 'ZZZ', name: 'Nope' } }))
    .status === 403
);
check(
  'student blocked from super_admin user list',
  (await call('/api/admin/users', { token: admin.token })).status === 403
);

// 4. Validation -------------------------------------------------------------
check(
  'invalid service payload is rejected',
  (await call('/api/services', { method: 'POST', token: superAdmin.token, body: { code: 'x', name: 'A' } }))
    .status === 400
);
check(
  'unknown service id is rejected',
  (await call('/api/queue/status?serviceId=not-an-id')).status === 400
);

// 5. Super admin service CRUD ----------------------------------------------
const testCode = `QA${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
const createdService = await call('/api/services', {
  method: 'POST',
  token: superAdmin.token,
  body: {
    code: testCode,
    name: 'Test Counter',
    description: 'Created by the smoke test',
    averageServiceMinutes: 3,
  },
});
check('super_admin creates a service', createdService.status === 201, createdService.body);

const patchedService = await call(`/api/services/${createdService.body?.service?.id}`, {
  method: 'PATCH',
  token: superAdmin.token,
  body: { averageServiceMinutes: 4, isActive: false },
});
check(
  'super_admin updates a service',
  patchedService.status === 200 && patchedService.body.service.averageServiceMinutes === 4
);
check(
  'service code uniqueness enforced',
  (
    await call('/api/services', {
      method: 'POST',
      token: superAdmin.token,
      body: { code: testCode, name: 'Duplicate' },
    })
  ).status === 409
);

// 6. Token issue ------------------------------------------------------------
const reg = services.find((service) => service.code === 'REG');
const issued = await call('/api/tokens', {
  method: 'POST',
  token: student.token,
  body: { serviceId: reg.id },
});
check('user issues a token', issued.status === 201, issued.body);
check('token number matches service code', /^REG-\d{3,}$/.test(issued.body.token?.tokenNumber || ''));
check('token carries a position >= 1', issued.body.token?.position >= 1);
check('token carries an ETA', typeof issued.body.token?.estimatedWaitMinutes === 'number');
check(
  'duplicate active token is rejected',
  (await call('/api/tokens', { method: 'POST', token: student.token, body: { serviceId: reg.id } }))
    .status === 409
);

const mine = await call('/api/tokens/my', { token: student.token });
check('tokens/my lists the active token', mine.body.active.some((token) => token.id === issued.body.token.id));
check('tokens/my includes history', Array.isArray(mine.body.history) && mine.body.history.length > 0);

const position = await call(`/api/queue/position?serviceId=${reg.id}`, { token: student.token });
check(
  'position endpoint agrees with issue response',
  position.status === 200 && position.body.token?.tokenNumber === issued.body.token.tokenNumber
);

// 7. Atomic concurrency (the core cloud property) ---------------------------
const parallelUsers = await Promise.all(
  Array.from({ length: 8 }, (_, index) => login(`loadtest${index}@campus.edu`))
);
const parallelIssues = await Promise.all(
  parallelUsers.map((user) =>
    call('/api/tokens', { method: 'POST', token: user.token, body: { serviceId: reg.id } })
  )
);
const numbers = parallelIssues.map((result) => result.body.token?.tokenNumber).filter(Boolean);
check('8 concurrent issues all succeed', parallelIssues.every((result) => result.status === 201));
check('8 concurrent issues yield 8 unique token numbers', new Set(numbers).size === 8, numbers);

const [callA, callB] = await Promise.all([
  call('/api/admin/call-next', { method: 'POST', token: admin.token, body: { serviceId: reg.id } }),
  call('/api/admin/call-next', { method: 'POST', token: admin.token, body: { serviceId: reg.id } }),
]);
const servingNumbers = [callA.body.serving?.tokenNumber, callB.body.serving?.tokenNumber].filter(Boolean);
check(
  'concurrent call-next never returns the same token twice',
  new Set(servingNumbers).size === servingNumbers.length,
  servingNumbers
);
check('concurrent call-next both succeed', callA.status === 200 && callB.status === 200);

const adminQueue = await call(`/api/admin/queue?serviceId=${reg.id}`, { token: admin.token });
const servingCount = adminQueue.body.tokens.filter((token) => token.status === 'serving').length;
check('exactly one token is serving per service', servingCount === 1, { servingCount });

// 8. Admin queue actions ----------------------------------------------------
const nowServing = adminQueue.body.tokens.find((token) => token.status === 'serving');
const served = await call(`/api/admin/mark-served/${nowServing.id}`, {
  method: 'POST',
  token: admin.token,
  body: { action: 'served' },
});
check('admin marks a token served', served.status === 200 && served.body.token.status === 'served', served.body);

const waitingToken = adminQueue.body.tokens.find((token) => token.status === 'waiting');
const noShow = await call(`/api/admin/mark-served/${waitingToken.id}`, {
  method: 'POST',
  token: admin.token,
  body: { action: 'no_show' },
});
check('admin marks a token no-show', noShow.status === 200 && noShow.body.token.status === 'no_show');
check(
  'closed token cannot be closed twice',
  (
    await call(`/api/admin/mark-served/${waitingToken.id}`, {
      method: 'POST',
      token: admin.token,
      body: { action: 'served' },
    })
  ).status === 409
);
check(
  'unknown action is rejected',
  (
    await call(`/api/admin/mark-served/${waitingToken.id}`, {
      method: 'POST',
      token: admin.token,
      body: { action: 'explode' },
    })
  ).status === 400
);

// 9. Cancel -----------------------------------------------------------------
const cln = services.find((service) => service.code === 'CLN');
const canceller = await login('canceltest1@campus.edu');
const cancellable = await call('/api/tokens', {
  method: 'POST',
  token: canceller.token,
  body: { serviceId: cln.id },
});
check('a fresh user can take a clinic token', cancellable.status === 201, cancellable.body);
const cancelled = await call(`/api/tokens/${cancellable.body?.token?.id}`, {
  method: 'DELETE',
  token: canceller.token,
});
check('owner cancels a waiting token', cancelled.status === 200 && cancelled.body.token.status === 'cancelled');

const otherUser = await login('canceltest2@campus.edu');
const otherUsersToken = (
  await call('/api/tokens', {
    method: 'POST',
    token: otherUser.token,
    body: { serviceId: cln.id },
  })
).body?.token;
const foreignCancel = await call(`/api/tokens/${otherUsersToken?.id}`, {
  method: 'DELETE',
  token: student.token,
});
check('a user cannot cancel somebody else’s token', foreignCancel.status === 403);

// 10. Analytics & history ---------------------------------------------------
const stats = await call(`/api/admin/stats?serviceId=${reg.id}`, { token: admin.token });
check('admin stats return totals', stats.status === 200 && stats.body.stats.totalIssued > 0);
check('stats include a 24 hour breakdown', stats.body.stats.hourlyBreakdown.length === 24);
check(
  'stats persist a daily roll-up',
  stats.body.stats.totalServed + stats.body.stats.totalNoShow + stats.body.stats.totalWaiting > 0
);

const campusStats = await call('/api/admin/stats', { token: admin.token });
check('stats work across all services', campusStats.status === 200 && campusStats.body.byService.length >= 4);

const history = await call(`/api/admin/history?serviceId=${reg.id}&limit=5`, { token: admin.token });
check('history paginates', history.status === 200 && history.body.pagination.limit === 5);
check('history page size respected', history.body.history.length <= 5);

const auditRes = await call('/api/admin/audit?limit=50', { token: admin.token });
const actions = (auditRes.body.entries || []).map((entry) => entry.action);
check('audit log records admin actions', actions.includes('queue.call_next'), actions);
check('audit log records token issues', actions.includes('token.issue'));

// 11. Display board payload -------------------------------------------------
await call('/api/admin/call-next', { method: 'POST', token: admin.token, body: { serviceId: reg.id } });
const freshBoard = await call('/api/queue/board');
const boardRow = freshBoard.body.services.find((row) => row.code === 'REG');
check('board exposes serving token', boardRow && typeof boardRow.serving === 'string', boardRow);
check('board exposes waiting count', boardRow.waitingCount >= 0);
check(
  'board never leaks personal data',
  !JSON.stringify(freshBoard.body).includes('@campus.edu')
);

// 12. 404 -------------------------------------------------------------------
check('unknown API route returns JSON 404', (await call('/api/does-not-exist')).status === 404);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('Failures:');
  failures.forEach((name) => console.log(`  · ${name}`));
}

server.close();
process.exit(failures.length ? 1 : 0);
