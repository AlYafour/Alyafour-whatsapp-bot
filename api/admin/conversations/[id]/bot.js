const { withAuth } = require('../../../../lib/authMiddleware');
const { getConversationById, returnToBot, logAudit } = require('../../../../lib/conversationService');
const { sendAndLogMessage } = require('../../../../lib/messagingService');
const { getSession, saveSession, defaultSession } = require('../../../../lib/sessionManager');
const { isValidUuid } = require('../../../../lib/validation');

const RESUME_MESSAGE = {
  ar: 'تم استئناف المساعدة الآلية ✅\n\nاكتب *قائمة* لعرض الخيارات.',
  en: 'Automated assistance has resumed ✅\n\nType *menu* to see the options.',
};

// Returns a conversation to the bot: clears assignment/handoff state, resets
// the Upstash session's temporary AI history, and optionally tells the
// customer that automated assistance is back.
module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  if (!isValidUuid(id)) return res.status(400).json({ error: 'Invalid conversation id' });

  const notifyCustomer = req.body?.notifyCustomer !== false;

  try {
    const existing = await getConversationById(id);
    if (!existing) return res.status(404).json({ error: 'Conversation not found' });

    const conversation = await returnToBot(id);

    const previousSession = await getSession(existing.wa_id);
    const lang = previousSession?.language === 'en' ? 'en' : 'ar';
    const freshSession = defaultSession();
    freshSession.language = lang;
    freshSession.step = 'chat';
    await saveSession(existing.wa_id, freshSession);

    if (notifyCustomer) {
      await sendAndLogMessage({
        conversationId: id,
        waId: existing.wa_id,
        text: RESUME_MESSAGE[lang],
        senderType: 'bot',
      });
    }

    await logAudit({ userId: req.user.id, conversationId: id, action: 'return_to_bot' });
    return res.status(200).json({ conversation });
  } catch (err) {
    console.error('[admin/conversations/:id/bot] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
