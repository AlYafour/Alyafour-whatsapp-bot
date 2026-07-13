const { withAuth } = require('../../lib/authMiddleware');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({ user: req.user });
});
