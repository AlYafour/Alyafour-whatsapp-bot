const webpush = require('web-push');
const {
  getPushSubscriptionsForUser,
  getPushSubscriptionsForUsers,
  getAllActiveAgentIds,
  deletePushSubscriptionsByEndpoints,
} = require('./pushSubscriptionService');

// Web Push is entirely optional: every function here silently no-ops if
// VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY aren't set, so a deployment without
// them behaves exactly as before (in-app notifications still work).
function isConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function ensureConfigured() {
  if (configured || !isConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@alyafour.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

async function sendToSubscriptions(subscriptions, payload) {
  if (!subscriptions.length) return;
  ensureConfigured();
  const body = JSON.stringify(payload);
  const expiredEndpoints = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      } catch (err) {
        // 404/410 means the browser unsubscribed or the subscription expired.
        if (err.statusCode === 404 || err.statusCode === 410) expiredEndpoints.push(sub.endpoint);
        else console.error('[webPush] send failed:', err.message);
      }
    })
  );

  if (expiredEndpoints.length) await deletePushSubscriptionsByEndpoints(expiredEndpoints);
}

async function notifyUser(userId, payload) {
  if (!isConfigured()) return;
  await sendToSubscriptions(await getPushSubscriptionsForUser(userId), payload);
}

async function notifyUsers(userIds, payload) {
  if (!isConfigured() || !userIds?.length) return;
  await sendToSubscriptions(await getPushSubscriptionsForUsers(userIds), payload);
}

async function notifyAllActiveAgents(payload) {
  if (!isConfigured()) return;
  await notifyUsers(await getAllActiveAgentIds(), payload);
}

module.exports = { isConfigured, notifyUser, notifyUsers, notifyAllActiveAgents };
