const { sql, query } = require('./db');

async function upsertPushSubscription({ userId, endpoint, p256dh, auth }) {
  const rows = await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${userId}, ${endpoint}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth
    RETURNING *
  `;
  return rows[0];
}

async function deletePushSubscription(endpoint) {
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

async function deletePushSubscriptionsByEndpoints(endpoints) {
  if (!endpoints?.length) return;
  await query('DELETE FROM push_subscriptions WHERE endpoint = ANY($1::text[])', [endpoints]);
}

async function getPushSubscriptionsForUser(userId) {
  return sql`SELECT * FROM push_subscriptions WHERE user_id = ${userId}`;
}

async function getPushSubscriptionsForUsers(userIds) {
  if (!userIds?.length) return [];
  return query('SELECT * FROM push_subscriptions WHERE user_id = ANY($1::uuid[])', [userIds]);
}

async function getAllActiveAgentIds() {
  const rows = await sql`SELECT id FROM admin_users WHERE active = true`;
  return rows.map((r) => r.id);
}

module.exports = {
  upsertPushSubscription,
  deletePushSubscription,
  deletePushSubscriptionsByEndpoints,
  getPushSubscriptionsForUser,
  getPushSubscriptionsForUsers,
  getAllActiveAgentIds,
};
