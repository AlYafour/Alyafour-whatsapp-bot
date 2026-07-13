const { withAuth } = require('../../../lib/authMiddleware');
const { upsertPushSubscription } = require('../../../lib/pushSubscriptionService');
const { sanitizeText } = require('../../../lib/validation');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const endpoint = sanitizeText(req.body?.endpoint, 500);
  const p256dh = sanitizeText(req.body?.keys?.p256dh, 300);
  const auth = sanitizeText(req.body?.keys?.auth, 200);
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Invalid push subscription payload' });
  }

  try {
    await upsertPushSubscription({ userId: req.user.id, endpoint, p256dh, auth });
    return res.status(201).json({ status: 'ok' });
  } catch (err) {
    console.error('[push/subscribe] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
