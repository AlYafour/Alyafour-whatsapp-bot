const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fakeModule, fakeBareModule } = require('./helpers/fakeModule');

const sent = [];
let failWith410 = false;
fakeBareModule('web-push', {
  setVapidDetails: () => {},
  sendNotification: async (sub, body) => {
    if (failWith410) {
      const err = new Error('subscription gone');
      err.statusCode = 410;
      throw err;
    }
    sent.push({ endpoint: sub.endpoint, body });
  },
});

const subsByUser = { u1: [{ endpoint: 'e1', p256dh: 'p1', auth: 'a1' }] };
const deletedEndpoints = [];
let getUsersCallArgs = null;
fakeModule('lib/pushSubscriptionService.js', {
  getPushSubscriptionsForUser: async (userId) => subsByUser[userId] || [],
  getPushSubscriptionsForUsers: async (userIds) => {
    getUsersCallArgs = userIds;
    return userIds.flatMap((id) => subsByUser[id] || []);
  },
  getAllActiveAgentIds: async () => ['u1', 'u2'],
  deletePushSubscriptionsByEndpoints: async (endpoints) => deletedEndpoints.push(...endpoints),
});

test('webPush no-ops entirely when VAPID is not configured', async () => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  const webPush = require('../lib/webPush');

  assert.equal(webPush.isConfigured(), false);
  await webPush.notifyUser('u1', { title: 'hello' });
  await webPush.notifyAllActiveAgents({ title: 'broadcast' });
  assert.equal(sent.length, 0);
});

test('webPush sends to a user\'s subscriptions once VAPID is configured', async () => {
  process.env.VAPID_PUBLIC_KEY = 'test-public';
  process.env.VAPID_PRIVATE_KEY = 'test-private';
  const webPush = require('../lib/webPush');

  assert.equal(webPush.isConfigured(), true);
  await webPush.notifyUser('u1', { title: 'مرحبا', conversationId: 'c1' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].endpoint, 'e1');
  assert.match(sent[0].body, /مرحبا/);
});

test('webPush prunes a subscription that Meta/browser reports as gone (410)', async () => {
  failWith410 = true;
  const webPush = require('../lib/webPush');
  await webPush.notifyUser('u1', { title: 'x' });
  assert.deepEqual(deletedEndpoints, ['e1']);
  failWith410 = false;
});

test('notifyAllActiveAgents fans out to every active admin/agent id', async () => {
  const webPush = require('../lib/webPush');
  await webPush.notifyAllActiveAgents({ title: 'broadcast' });
  assert.deepEqual(getUsersCallArgs, ['u1', 'u2']);
});
