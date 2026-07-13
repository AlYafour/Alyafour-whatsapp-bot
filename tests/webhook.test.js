const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
process.env.VERIFY_TOKEN = 'alyafour_webhook_2024';

const { fakeModule } = require('./helpers/fakeModule');
const { createFakeDb } = require('./helpers/fakeDb');

const db = createFakeDb();
fakeModule('lib/db.js', db);

const sessions = new Map();
fakeModule('lib/sessionManager.js', {
  defaultSession: () => ({ step: 'language_selection', language: null, department: null, history: [], lastActivity: Date.now() }),
  getSession: async (phone) => sessions.get(phone) || { step: 'language_selection', language: null, department: null, history: [], lastActivity: Date.now() },
  saveSession: async (phone, session) => { sessions.set(phone, session); },
  isSessionExpired: (session) => Date.now() - (session.lastActivity || 0) > 15 * 60 * 1000,
});

const sentMessages = [];
fakeModule('lib/whatsappApi.js', {
  sendMessage: async (to, text) => {
    const id = 'wamid.' + Math.random().toString(16).slice(2);
    sentMessages.push({ to, text, id });
    return { messages: [{ id }] };
  },
  markAsRead: async () => {},
});

const webhook = require('../api/webhook');

function makeRes() {
  return {
    _status: null, _json: null,
    status(c) { this._status = c; return this; },
    json(o) { this._json = o; return this; },
    send(b) { this._json = b; return this; },
  };
}

function inboundMessage(overrides) {
  return {
    entry: [{ changes: [{ value: {
      contacts: overrides.name ? [{ profile: { name: overrides.name } }] : [],
      messages: [{ id: overrides.id, from: overrides.from, type: overrides.type || 'text', ...overrides.payload }],
    } }] }],
  };
}

test('GET verification still returns the challenge', async () => {
  const res = makeRes();
  await webhook({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'alyafour_webhook_2024', 'hub.challenge': 'c1' } }, res);
  assert.equal(res._status, 200);
  assert.equal(res._json, 'c1');
});

test('normal text message persists and triggers the welcome menu', async () => {
  const res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715550001', id: 'm1', name: 'Sara', type: 'text', payload: { text: { body: 'مرحبا' } } }) }, res);
  assert.equal(res._status, 200);
  const conv = db.state.conversations.find((c) => c.wa_id === '9715550001');
  assert.ok(conv, 'conversation should be created');
  assert.equal(conv.customer_name, 'Sara');
  assert.equal(sentMessages.at(-1).to, '9715550001');
});

test('duplicate wa_message_id does not create a duplicate message row', async () => {
  const before = db.state.messages.length;
  const res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715550001', id: 'm1', type: 'text', payload: { text: { body: 'مرحبا' } } }) }, res);
  assert.equal(res._status, 200);
  assert.equal(db.state.messages.length, before, 'no new row for a repeated wa_message_id');
});

test('sending "9" hands off to human exactly once', async () => {
  const sentBefore = sentMessages.length;
  let res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715550002', id: 'h1', type: 'text', payload: { text: { body: 'مرحبا' } } }) }, res);
  res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715550002', id: 'h2', type: 'text', payload: { text: { body: '9' } } }) }, res);
  const conv = db.state.conversations.find((c) => c.wa_id === '9715550002');
  assert.equal(conv.mode, 'human');
  assert.equal(conv.status, 'pending');
  const sentAfterFirstHandoff = sentMessages.length;

  res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715550002', id: 'h3', type: 'text', payload: { text: { body: '9' } } }) }, res);
  assert.equal(sentMessages.length, sentAfterFirstHandoff, 'no second human-agent message on repeat "9"');
  assert.ok(sentMessages.length > sentBefore);
});

test('bot stays silent and unread increments once a conversation is in human mode', async () => {
  const conv = db.state.conversations.find((c) => c.wa_id === '9715550002');
  const sentBefore = sentMessages.length;
  const unreadBefore = conv.unread_count;
  const res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715550002', id: 'h4', type: 'text', payload: { text: { body: 'أي حد موجود؟' } } }) }, res);
  assert.equal(sentMessages.length, sentBefore, 'bot must not reply while mode=human');
  assert.equal(conv.unread_count, unreadBefore + 1);
});

test('image message is stored with pending media status and does not trigger the bot', async () => {
  const sentBefore = sentMessages.length;
  const res = makeRes();
  await webhook({
    method: 'POST',
    body: inboundMessage({
      from: '9715550003', id: 'img1', type: 'image',
      payload: { image: { id: 'media-123', mime_type: 'image/jpeg', caption: 'شوف هذا' } },
    }),
  }, res);
  assert.equal(res._status, 200);
  const msg = db.state.messages.find((m) => m.wa_message_id === 'img1');
  assert.equal(msg.message_type, 'image');
  assert.equal(msg.media_status, 'pending');
  assert.equal(msg.caption, 'شوف هذا');
  assert.equal(sentMessages.length, sentBefore, 'non-text media must not drive the bot flow');
});

test('voice note is distinguished from a regular audio file via the voice flag', async () => {
  const res = makeRes();
  await webhook({
    method: 'POST',
    body: inboundMessage({ from: '9715550004', id: 'voice1', type: 'audio', payload: { audio: { id: 'media-v1', mime_type: 'audio/ogg', voice: true } } }),
  }, res);
  const msg = db.state.messages.find((m) => m.wa_message_id === 'voice1');
  assert.equal(msg.message_type, 'voice');

  const res2 = makeRes();
  await webhook({
    method: 'POST',
    body: inboundMessage({ from: '9715550004', id: 'audio1', type: 'audio', payload: { audio: { id: 'media-a1', mime_type: 'audio/aac', voice: false } } }),
  }, res2);
  const msg2 = db.state.messages.find((m) => m.wa_message_id === 'audio1');
  assert.equal(msg2.message_type, 'audio');
});

test('location and contacts messages persist their structured fields', async () => {
  const res = makeRes();
  await webhook({
    method: 'POST',
    body: inboundMessage({
      from: '9715550005', id: 'loc1', type: 'location',
      payload: { location: { latitude: 24.47, longitude: 54.37, name: 'Al Yafour Office', address: 'Abu Dhabi' } },
    }),
  }, res);
  const loc = db.state.messages.find((m) => m.wa_message_id === 'loc1');
  assert.equal(loc.message_type, 'location');
  assert.equal(loc.latitude, 24.47);
  assert.equal(loc.location_name, 'Al Yafour Office');

  const res2 = makeRes();
  await webhook({
    method: 'POST',
    body: inboundMessage({
      from: '9715550005', id: 'contact1', type: 'contacts',
      payload: { contacts: [{ name: { formatted_name: 'Khalid Al Yafour' }, phones: [{ phone: '+971501112222' }] }] },
    }),
  }, res2);
  const contactMsg = db.state.messages.find((m) => m.wa_message_id === 'contact1');
  assert.equal(contactMsg.message_type, 'contacts');
  assert.equal(contactMsg.contacts_data[0].name.formatted_name, 'Khalid Al Yafour');
});

test('reaction attaches to the target message via reacted_message_wa_id', async () => {
  const res = makeRes();
  await webhook({
    method: 'POST',
    body: inboundMessage({ from: '9715550001', id: 'react1', type: 'reaction', payload: { reaction: { message_id: 'm1', emoji: '👍' } } }),
  }, res);
  const reaction = db.state.messages.find((m) => m.wa_message_id === 'react1');
  assert.equal(reaction.message_type, 'reaction');
  assert.equal(reaction.reacted_message_wa_id, 'm1');
  assert.equal(reaction.reaction_emoji, '👍');
});

test('user_changed_number system event renames the conversation without creating a new one or opening the 24h window', async () => {
  // Seed a conversation with prior history under the old number.
  let res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715559991', id: 'pre1', type: 'text', payload: { text: { body: 'مرحبا' } } }) }, res);
  const before = db.state.conversations.find((c) => c.wa_id === '9715559991');
  const unreadBefore = before.unread_count;
  const messageCountBefore = db.state.messages.length;

  res = makeRes();
  await webhook({
    method: 'POST',
    body: {
      entry: [{ changes: [{ value: {
        messages: [{ id: 'sys1', from: '9715559991', type: 'system', system: { type: 'user_changed_number', body: 'User changed number', wa_id: '9715559992' } }],
      } }] }],
    },
  }, res);

  assert.equal(res._status, 200);
  const renamed = db.state.conversations.find((c) => c.wa_id === '9715559992');
  assert.ok(renamed, 'conversation should now be found under the new number');
  assert.equal(db.state.conversations.find((c) => c.wa_id === '9715559991'), undefined, 'old number should no longer resolve to a conversation');
  assert.equal(renamed.unread_count, unreadBefore, 'system event must not increment unread_count');
  assert.equal(db.state.messages.length, messageCountBefore + 1, 'system event stored as exactly one message row');

  const historyEntry = db.state.waIdHistory.find((h) => h.old_wa_id === '9715559991' && h.new_wa_id === '9715559992');
  assert.ok(historyEntry, 'phone-change history must be recorded');
});

test('user_changed_number merges into an existing conversation under the new number without losing or duplicating messages', async () => {
  let res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715559993', id: 'old-a', type: 'text', payload: { text: { body: 'رسالة قديمة' } } }) }, res);
  res = makeRes();
  await webhook({ method: 'POST', body: inboundMessage({ from: '9715559994', id: 'new-a', type: 'text', payload: { text: { body: 'رسالة من الرقم الجديد قبل الحدث' } } }) }, res);

  const oldConv = db.state.conversations.find((c) => c.wa_id === '9715559993');
  const newConv = db.state.conversations.find((c) => c.wa_id === '9715559994');
  assert.notEqual(oldConv.id, newConv.id);

  res = makeRes();
  await webhook({
    method: 'POST',
    body: {
      entry: [{ changes: [{ value: {
        messages: [{ id: 'sys2', from: '9715559993', type: 'system', system: { type: 'user_changed_number', body: 'x', wa_id: '9715559994' } }],
      } }] }],
    },
  }, res);

  const conversationsUnderNewNumber = db.state.conversations.filter((c) => c.wa_id === '9715559994');
  assert.equal(conversationsUnderNewNumber.length, 1, 'conflict must merge into a single conversation, not create a duplicate');

  const survivingId = conversationsUnderNewNumber[0].id;
  const messagesForSurvivor = db.state.messages.filter((m) => m.conversation_id === survivingId);
  assert.ok(messagesForSurvivor.some((m) => m.wa_message_id === 'old-a'), 'old conversation history preserved');
  assert.ok(messagesForSurvivor.some((m) => m.wa_message_id === 'new-a'), 'pre-existing new-number history preserved');
});

test('duplicate system event delivery does not re-run the rename', async () => {
  const conv = db.state.conversations.find((c) => c.wa_id === '9715559992');
  const messageCountBefore = db.state.messages.length;

  const res = makeRes();
  await webhook({
    method: 'POST',
    body: {
      entry: [{ changes: [{ value: {
        messages: [{ id: 'sys1', from: '9715559991', type: 'system', system: { type: 'user_changed_number', body: 'x', wa_id: '9715559992' } }],
      } }] }],
    },
  }, res);

  assert.equal(db.state.messages.length, messageCountBefore, 'duplicate wa_message_id for the system event must not insert again');
  assert.ok(db.state.conversations.find((c) => c.id === conv.id));
});
