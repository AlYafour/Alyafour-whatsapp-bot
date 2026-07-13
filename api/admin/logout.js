const { withAuth } = require('../../lib/authMiddleware');
const { clearAuthCookie } = require('../../lib/auth');
const { logAudit } = require('../../lib/conversationService');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  clearAuthCookie(res);
  await logAudit({ userId: req.user.id, action: 'logout' });
  return res.status(200).json({ status: 'ok' });
});
