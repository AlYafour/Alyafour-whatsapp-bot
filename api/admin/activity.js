const { withAuth } = require('../../lib/authMiddleware');
const { listAllActivity } = require('../../lib/conversationService');
const { isValidUuid } = require('../../lib/validation');

// Global, cross-employee activity feed — admin-only. Agents keep exactly
// the permissions the existing role system already grants them (they can
// still see the per-conversation timeline via activity.js above).
module.exports = withAuth(
  async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { page, pageSize, userId, action } = req.query;
    if (userId && !isValidUuid(userId)) return res.status(400).json({ error: 'INVALID_REQUEST' });

    try {
      const result = await listAllActivity({
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 50,
        userId: userId || null,
        action: action || null,
      });
      return res.status(200).json(result);
    } catch (err) {
      console.error('[admin/activity] error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
  { roles: ['admin'] }
);
