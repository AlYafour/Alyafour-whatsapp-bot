const { withAuth } = require('../../../lib/authMiddleware');
const { listConversations } = require('../../../lib/conversationService');
const { sanitizeText } = require('../../../lib/validation');

const VALID_MODES = ['bot', 'human'];
const VALID_STATUSES = ['open', 'pending', 'closed'];

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { page, pageSize, search, mode, status, unread, assignedTo } = req.query;

  if (mode && !VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode filter' });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }

  try {
    const result = await listConversations({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 30,
      search: search ? sanitizeText(search, 100) : null,
      mode: mode || null,
      status: status || null,
      unreadOnly: unread === 'true' || unread === '1',
      assignedTo: assignedTo || null,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[admin/conversations] list error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
