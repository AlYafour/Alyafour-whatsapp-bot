const { withAuth } = require('../../../../lib/authMiddleware');
const { getConversationById, claimConversation, logAudit } = require('../../../../lib/conversationService');
const { isValidUuid } = require('../../../../lib/validation');

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  if (!isValidUuid(id)) return res.status(400).json({ error: 'Invalid conversation id' });

  try {
    const existing = await getConversationById(id);
    if (!existing) return res.status(404).json({ error: 'Conversation not found' });

    const conversation = await claimConversation(id, req.user.id);
    await logAudit({ userId: req.user.id, conversationId: id, action: 'claim' });
    return res.status(200).json({ conversation });
  } catch (err) {
    console.error('[admin/conversations/:id/claim] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
