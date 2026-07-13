const { withAuth } = require('../../../lib/authMiddleware');
const { deletePushSubscription } = require('../../../lib/pushSubscriptionService');
const { sanitizeText } = require('../../../lib/validation');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const endpoint = sanitizeText(req.body?.endpoint, 500);
  if (!endpoint) return res.status(400).json({ error: 'INVALID_REQUEST' });

  try {
    await deletePushSubscription(endpoint);
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[push/unsubscribe] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
