const { withAuth } = require('../../../../lib/authMiddleware');
const { getConversationById, listConversationActivity } = require('../../../../lib/conversationService');
const { isValidUuid } = require('../../../../lib/validation');

// Per-conversation accountability timeline — any authenticated admin/agent
// can view it, same as they can already view the conversation itself.
module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!isValidUuid(id)) return res.status(400).json({ error: 'INVALID_REQUEST' });

  try {
    const conversation = await getConversationById(id);
    if (!conversation) return res.status(404).json({ error: 'NOT_FOUND' });

    const activity = await listConversationActivity(id);
    return res.status(200).json({ activity });
  } catch (err) {
    console.error('[conversations/:id/activity] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
