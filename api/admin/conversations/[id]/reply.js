const { withAuth } = require('../../../../lib/authMiddleware');
const { getConversationById, logAudit } = require('../../../../lib/conversationService');
const { sendAndLogMessage } = require('../../../../lib/messagingService');
const { isValidUuid, sanitizeText } = require('../../../../lib/validation');

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGE_LEN = 4096;

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!isValidUuid(id)) return res.status(400).json({ error: 'Invalid conversation id' });

  const text = sanitizeText(req.body?.text, MAX_MESSAGE_LEN);
  if (!text) return res.status(400).json({ error: 'Message text is required' });
  const contextMessageWaId = sanitizeText(req.body?.contextMessageWaId, 128) || null;

  try {
    const conversation = await getConversationById(id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const lastCustomerAt = conversation.last_customer_message_at
      ? new Date(conversation.last_customer_message_at).getTime()
      : null;
    const windowOpen = lastCustomerAt ? Date.now() - lastCustomerAt < SERVICE_WINDOW_MS : false;

    if (!windowOpen) {
      return res.status(422).json({
        error: 'TEMPLATE_REQUIRED',
        message:
          'The 24-hour customer service window has expired for this conversation. Send an approved WhatsApp message template to re-open it.',
      });
    }

    const { message, error } = await sendAndLogMessage({
      conversationId: id,
      waId: conversation.wa_id,
      text,
      senderType: 'agent',
      sentBy: req.user.id,
      resetUnread: true,
      contextMessageWaId,
    });

    if (error) {
      return res.status(502).json({
        error: 'WHATSAPP_SEND_FAILED',
        message: error.message || 'Failed to send message via WhatsApp',
        savedMessage: message,
      });
    }

    await logAudit({ userId: req.user.id, conversationId: id, action: 'agent_reply', metadata: { messageId: message.id } });

    return res.status(200).json({ message });
  } catch (err) {
    console.error('[admin/conversations/:id/reply] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
