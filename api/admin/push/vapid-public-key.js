const { withAuth } = require('../../../lib/authMiddleware');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.VAPID_PUBLIC_KEY) return res.status(404).json({ error: 'NOT_CONFIGURED' });
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});
