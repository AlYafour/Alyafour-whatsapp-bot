const { withAuth } = require('../../../../lib/authMiddleware');
const { getConversationById, listMessages } = require('../../../../lib/conversationService');
const { isValidUuid } = require('../../../../lib/validation');

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!isValidUuid(id)) return res.status(400).json({ error: 'Invalid conversation id' });

  try {
    const conversation = await getConversationById(id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const messages = await listMessages(id, { limit: 500 });

    const lastCustomerAt = conversation.last_customer_message_at
      ? new Date(conversation.last_customer_message_at).getTime()
      : null;
    const windowExpiresAt = lastCustomerAt ? lastCustomerAt + SERVICE_WINDOW_MS : null;
    const windowOpen = windowExpiresAt ? Date.now() < windowExpiresAt : false;

    return res.status(200).json({
      conversation,
      messages,
      serviceWindow: {
        open: windowOpen,
        expiresAt: windowExpiresAt ? new Date(windowExpiresAt).toISOString() : null,
      },
    });
  } catch (err) {
    console.error('[admin/conversations/:id] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
