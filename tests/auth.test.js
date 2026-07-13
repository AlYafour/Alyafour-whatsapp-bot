const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret';

const { fakeModule } = require('./helpers/fakeModule');

const users = {
  u1: { id: 'u1', name: 'Admin', email: 'a@b.com', role: 'admin', active: true },
  u2: { id: 'u2', name: 'Agent', email: 'b@b.com', role: 'agent', active: false },
  u3: { id: 'u3', name: 'Agent2', email: 'c@b.com', role: 'agent', active: true },
};
fakeModule('lib/db.js', { sql: async (strings, id) => (users[id] ? [users[id]] : []), query: async () => [], transaction: async () => [] });

const { withAuth } = require('../lib/authMiddleware');
const { signToken } = require('../lib/auth');

function makeRes() {
  return { _status: null, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}

test('withAuth rejects requests with no session cookie', async () => {
  const handler = withAuth(async (req, res) => res.status(200).json({ ok: true }));
  const res = makeRes();
  await handler({ headers: {} }, res);
  assert.equal(res._status, 401);
});

test('withAuth accepts a valid admin session', async () => {
  const handler = withAuth(async (req, res) => res.status(200).json({ ok: true, email: req.user.email }), { roles: ['admin'] });
  const token = signToken({ id: 'u1', email: 'a@b.com', role: 'admin', name: 'Admin' });
  const res = makeRes();
  await handler({ headers: { cookie: 'ay_session=' + token } }, res);
  assert.equal(res._status, 200);
  assert.equal(res._json.email, 'a@b.com');
});

test('withAuth rejects a deactivated user even with a valid token', async () => {
  const handler = withAuth(async (req, res) => res.status(200).json({ ok: true }));
  const token = signToken({ id: 'u2', email: 'b@b.com', role: 'agent', name: 'Agent' });
  const res = makeRes();
  await handler({ headers: { cookie: 'ay_session=' + token } }, res);
  assert.equal(res._status, 401);
});

test('withAuth returns 403 when the role does not match', async () => {
  const handler = withAuth(async (req, res) => res.status(200).json({ ok: true }), { roles: ['admin'] });
  const token = signToken({ id: 'u3', email: 'c@b.com', role: 'agent', name: 'Agent2' });
  const res = makeRes();
  await handler({ headers: { cookie: 'ay_session=' + token } }, res);
  assert.equal(res._status, 403);
});

test('withAuth rejects a garbage/expired token', async () => {
  const handler = withAuth(async (req, res) => res.status(200).json({ ok: true }));
  const res = makeRes();
  await handler({ headers: { cookie: 'ay_session=not-a-real-token' } }, res);
  assert.equal(res._status, 401);
});
