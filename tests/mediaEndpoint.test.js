const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret';

const CONV_ID = crypto.randomUUID();
const MSG_ID = crypto.randomUUID();
const MSG2_ID = crypto.randomUUID();

const { fakeModule } = require('./helpers/fakeModule');
const { createFakeDb } = require('./helpers/fakeDb');

const db = createFakeDb();
db.state.users.u1 = { id: 'u1', name: 'Agent1', email: 'a@b.com', role: 'agent', active: true };
fakeModule('lib/db.js', db);

let shouldFail = true;
fakeModule('lib/mediaDownload.js', {
  fetchMetaMedia: async () => {
    if (shouldFail) throw new Error('simulated Meta outage');
    return { buffer: Buffer.from('fake-image-bytes'), mimeType: 'image/jpeg', fileSize: 17, sha256: 'abc' };
  },
});
// An intentionally-invalid URL: https.get() throws synchronously on it
// (Invalid URL) instead of attempting a real DNS lookup, so this test suite
// never touches the network while still exercising the download/storage
// update logic under test.
fakeModule('lib/storage.js', {
  uploadMedia: async ({ key }) => ({ key, url: 'not-a-real-url' }),
});

const { signToken } = require('../lib/auth');
const mediaHandler = require('../api/admin/media/[messageId].js');

function makeRes() {
  return { _status: null, _json: null, status(c) { this._status = c; return this; }, json(o) { this._json = o; return this; } };
}
function authedReq(query) {
  const token = signToken({ id: 'u1', email: 'a@b.com', role: 'agent', name: 'Agent1' });
  return { method: 'GET', headers: { cookie: 'ay_session=' + token }, query };
}

test('media endpoint requires authentication', async () => {
  const res = makeRes();
  await mediaHandler({ method: 'GET', headers: {}, query: { messageId: '11111111-1111-1111-1111-111111111111' } }, res);
  assert.equal(res._status, 401);
});

test('media endpoint returns a retriable error when the Meta download fails, and marks media_status failed', async () => {
  const conv = { id: CONV_ID, wa_id: '9715550000' };
  db.state.conversations.push(conv);
  const msg = {
    id: MSG_ID, conversation_id: conv.id, wa_message_id: 'wm1', message_type: 'image',
    media_id: 'meta-media-1', media_status: 'pending', mime_type: 'image/jpeg',
  };
  db.state.messages.push(msg);

  shouldFail = true;
  const res = makeRes();
  await mediaHandler(authedReq({ messageId: MSG_ID }), res);
  assert.equal(res._status, 502);
  assert.equal(res._json.retriable, true);
  assert.equal(msg.media_status, 'failed');
});

test('media endpoint retries successfully once the download succeeds and caches media_status stored', async () => {
  shouldFail = false;
  const res = makeRes();
  try {
    await mediaHandler(authedReq({ messageId: MSG_ID }), res);
  } catch {
    // The fake storage URL is intentionally invalid so no real network call
    // is made — only the download+persist logic above it is under test.
  }
  const msg = db.state.messages.find((m) => m.id === MSG_ID);
  assert.equal(msg.media_status, 'stored');
  assert.equal(msg.storage_url, 'not-a-real-url');
});

test('media endpoint returns 404 for a message with no attached media', async () => {
  db.state.messages.push({ id: MSG2_ID, conversation_id: CONV_ID, message_type: 'text', media_id: null, storage_url: null });
  const res = makeRes();
  await mediaHandler(authedReq({ messageId: MSG2_ID }), res);
  assert.equal(res._status, 404);
});
