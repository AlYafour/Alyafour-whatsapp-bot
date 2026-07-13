const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret';

const { fakeModule } = require('./helpers/fakeModule');
const { createFakeDb } = require('./helpers/fakeDb');

const db = createFakeDb();
db.state.users.admin1 = { id: 'admin1', name: 'Admin One', email: 'admin@b.com', role: 'admin', active: true };
db.state.users.agent1 = { id: 'agent1', name: 'Agent One', email: 'agent@b.com', role: 'agent', active: true };
fakeModule('lib/db.js', db);

const { signToken } = require('../lib/auth');
const conversationDetailHandler = require('../api/admin/conversations/[id]/index.js');
const conversationActivityHandler = require('../api/admin/conversations/[id]/activity.js');
const globalActivityHandler = require('../api/admin/activity.js');
const { getOrCreateConversation, recordOutboundMessage, logAudit, claimConversation, releaseConversation } = require('../lib/conversationService');

function makeRes() {
  return { _status: null, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}
function authedReq(userId, role, query = {}) {
  const token = signToken({ id: userId, email: db.state.users[userId].email, role, name: db.state.users[userId].name });
  return { method: 'GET', headers: { cookie: 'ay_session=' + token }, query };
}

test('conversation messages expose sent_by_name for accountability', async () => {
  const conv = await getOrCreateConversation('971500001111', 'Test Customer');
  await recordOutboundMessage({ conversationId: conv.id, senderType: 'agent', sentBy: 'agent1', text: 'مرحباً، كيف أساعدك؟', status: 'sent' });

  const res = makeRes();
  await conversationDetailHandler(authedReq('agent1', 'agent', { id: conv.id }), res);

  assert.equal(res._status, 200);
  const msg = res._json.messages.find((m) => m.text === 'مرحباً، كيف أساعدك؟');
  assert.equal(msg.sent_by_name, 'Agent One');
});

test('per-conversation activity timeline records claim/release with actor name and is visible to agents', async () => {
  const conv = await getOrCreateConversation('971500002222', 'Another Customer');
  await claimConversation(conv.id, 'agent1');
  await logAudit({ userId: 'agent1', conversationId: conv.id, action: 'claim' });
  await releaseConversation(conv.id);
  await logAudit({ userId: 'agent1', conversationId: conv.id, action: 'release' });

  const res = makeRes();
  await conversationActivityHandler(authedReq('agent1', 'agent', { id: conv.id }), res);

  assert.equal(res._status, 200);
  assert.equal(res._json.activity.length, 2);
  assert.equal(res._json.activity[0].actor_name, 'Agent One'); // most recent first (release)
  assert.equal(res._json.activity[0].action, 'release');
  assert.equal(res._json.activity[1].action, 'claim');
});

test('global activity feed is admin-only — agents get 403, admins get 200', async () => {
  let res = makeRes();
  await globalActivityHandler(authedReq('agent1', 'agent'), res);
  assert.equal(res._status, 403);

  res = makeRes();
  await globalActivityHandler(authedReq('admin1', 'admin'), res);
  assert.equal(res._status, 200);
  assert.ok(Array.isArray(res._json.rows));
  assert.ok(res._json.rows.length >= 2);
});

test('global activity feed can be filtered by action', async () => {
  const res = makeRes();
  await globalActivityHandler(authedReq('admin1', 'admin', { action: 'claim' }), res);
  assert.equal(res._status, 200);
  assert.ok(res._json.rows.every((r) => r.action === 'claim'));
  assert.ok(res._json.rows.length >= 1);
});
