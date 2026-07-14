const { withAuth } = require('../../../../lib/authMiddleware');
const { getConversationById, listMessages, deleteConversation, logAudit } = require('../../../../lib/conversationService');
const { deleteMedia } = require('../../../../lib/storage');
const { isValidUuid } = require('../../../../lib/validation');

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

module.exports = withAuth(async (req, res) => {
  const { id } = req.query;
  if (!isValidUuid(id)) return res.status(400).json({ error: 'Invalid conversation id' });

  // ── Admin-only hard delete of a conversation and all its messages ──────────
  if (req.method === 'DELETE') {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'حذف المحادثات متاح للمدير فقط' });
    }
    try {
      const conversation = await getConversationById(id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const { storageKeys } = await deleteConversation(id);
      // Blob cleanup is best-effort — the conversation is already gone.
      Promise.allSettled(storageKeys.map((key) => deleteMedia(key))).catch(() => {});

      await logAudit({
        userId: req.user.id,
        conversationId: null,
        action: 'delete_conversation',
        metadata: { waId: conversation.wa_id, customerName: conversation.customer_name, deletedConversationId: id },
      });

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[admin/conversations/:id] delete error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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
