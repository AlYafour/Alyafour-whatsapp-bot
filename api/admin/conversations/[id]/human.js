const { withAuth } = require('../../../../lib/authMiddleware');
const { getConversationById, requestHandoff, logAudit } = require('../../../../lib/conversationService');
const { isValidUuid } = require('../../../../lib/validation');

// Manual switch-to-human by an agent/admin (e.g. intercepting a bot chat
// before the customer asks). Does not send any message to the customer —
// the agent decides what to say via the reply endpoint.
module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  if (!isValidUuid(id)) return res.status(400).json({ error: 'Invalid conversation id' });

  try {
    const existing = await getConversationById(id);
    if (!existing) return res.status(404).json({ error: 'Conversation not found' });

    const { conversation, alreadyHandedOff } = await requestHandoff(id);
    await logAudit({ userId: req.user.id, conversationId: id, action: 'switch_to_human' });
    return res.status(200).json({ conversation, alreadyHandedOff });
  } catch (err) {
    console.error('[admin/conversations/:id/human] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
