const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret';
process.env.WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'tok';
process.env.PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '123';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '456';

const { fakeModule } = require('./helpers/fakeModule');
const { createFakeDb } = require('./helpers/fakeDb');

const db = createFakeDb();
db.state.users.u1 = { id: 'u1', name: 'Agent1', email: 'a@b.com', role: 'agent', active: true };
fakeModule('lib/db.js', db);
fakeModule('lib/idempotency.js', { claimIdempotencyKey: async () => true });
fakeModule('lib/rateLimiter.js', {
  checkLoginRateLimit: async () => true,
  checkTemplateSendRateLimit: async () => true,
  checkMediaSendRateLimit: async () => true,
});

const APPROVED_TEMPLATE = {
  name: 'order_ready', category: 'UTILITY', language: 'ar', status: 'APPROVED',
  components: [{ type: 'BODY', text: 'مرحباً {{1}}' }],
};
fakeModule('lib/metaGraph.js', {
  graphGet: async (path) => {
    if (path.includes('/message_templates')) return { status: 200, body: { data: [APPROVED_TEMPLATE], paging: {} } };
    return { status: 200, body: { display_phone_number: '+971500000000' } };
  },
  graphPost: async () => ({ status: 200, body: { messages: [{ id: 'wamid.OUT' + Math.random() }] } }),
});
fakeModule('lib/whatsappApi.js', {
  sendMessage: async () => ({ messages: [{ id: 'wamid.TXT' + Math.random() }] }),
  markAsRead: async () => {},
});

const { signToken } = require('../lib/auth');
const newConversationHandler = require('../api/admin/conversations/new.js');
const replyHandler = require('../api/admin/conversations/[id]/reply.js');
const reactHandler = require('../api/admin/conversations/[id]/react.js');

function makeRes() {
  return { _status: null, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}
function agentReq(body, query = {}) {
  const token = signToken({ id: 'u1', email: 'a@b.com', role: 'agent', name: 'Agent1' });
  return { method: 'POST', body, headers: { cookie: 'ay_session=' + token, 'idempotency-key': 'k-' + Math.random() }, query };
}

test('POST /conversations/new creates a fresh conversation in human/pending mode assigned to the sender', async () => {
  const res = makeRes();
  await newConversationHandler(
    agentReq({ phone: '971555001122', templateName: 'order_ready', languageCode: 'ar', components: [{ type: 'body', parameters: [{ type: 'text', text: 'Sara' }] }] })
  , res);
  assert.equal(res._status, 201);
  assert.equal(res._json.conversation.mode, 'human');
  assert.equal(res._json.conversation.status, 'pending');
  assert.equal(res._json.conversation.assigned_to, 'u1');
  assert.equal(res._json.message.message_type, 'template');
});

test('POST /conversations/new rejects an invalid phone number', async () => {
  const res = makeRes();
  await newConversationHandler(agentReq({ phone: 'not-a-phone', templateName: 'order_ready', languageCode: 'ar', components: [] }), res);
  assert.equal(res._status, 400);
  assert.equal(res._json.error, 'INVALID_PHONE');
});

test('POST /conversations/new rejects sending to the business own number', async () => {
  const res = makeRes();
  await newConversationHandler(agentReq({ phone: '971500000000', templateName: 'order_ready', languageCode: 'ar', components: [] }), res);
  assert.equal(res._status, 400);
  assert.equal(res._json.error, 'INVALID_PHONE');
});

test('reply is blocked with TEMPLATE_REQUIRED outside the 24h window', async () => {
  // The conversation created above has no last_customer_message_at yet.
  const conv = db.state.conversations.find((c) => c.wa_id === '971555001122');
  const res = makeRes();
  await replyHandler(agentReq({ text: 'hello' }, { id: conv.id }), res);
  assert.equal(res._status, 422);
  assert.equal(res._json.error, 'TEMPLATE_REQUIRED');
});

test('reply succeeds once the 24h window is open', async () => {
  const conv = db.state.conversations.find((c) => c.wa_id === '971555001122');
  conv.last_customer_message_at = new Date();
  const res = makeRes();
  await replyHandler(agentReq({ text: 'hello' }, { id: conv.id }), res);
  assert.equal(res._status, 200);
  assert.equal(res._json.message.sender_type, 'agent');
});

test('reaction is rejected when the target message does not belong to the conversation', async () => {
  const conv = db.state.conversations.find((c) => c.wa_id === '971555001122');
  const res = makeRes();
  await reactHandler(agentReq({ targetWaMessageId: 'does-not-exist', emoji: '👍' }, { id: conv.id }), res);
  assert.equal(res._status, 404);
});
