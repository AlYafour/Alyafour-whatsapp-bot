const { withAuth } = require('../../../../lib/authMiddleware');
const {
  getConversationById,
  getMessageByWaMessageId,
  recordOutboundMessage,
  logAudit,
} = require('../../../../lib/conversationService');
const { sendReactionMessage } = require('../../../../lib/whatsappMedia');
const { checkMediaSendRateLimit } = require('../../../../lib/rateLimiter');
const { isValidUuid, sanitizeText } = require('../../../../lib/validation');

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function fail(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  if (!isValidUuid(id)) return fail(res, 400, 'INVALID_REQUEST', 'معرف المحادثة غير صحيح');

  const targetWaMessageId = sanitizeText(req.body?.targetWaMessageId, 128);
  const emoji = sanitizeText(req.body?.emoji, 8); // '' clears a reaction
  if (!targetWaMessageId) return fail(res, 400, 'INVALID_REQUEST', 'يجب تحديد الرسالة المراد التفاعل معها');

  const rateOk = await checkMediaSendRateLimit(req.user.id);
  if (!rateOk) return fail(res, 429, 'RATE_LIMITED', 'عدد كبير جداً من المحاولات، حاول لاحقاً');

  try {
    const conversation = await getConversationById(id);
    if (!conversation) return fail(res, 404, 'NOT_FOUND', 'المحادثة غير موجودة');

    const targetMessage = await getMessageByWaMessageId(targetWaMessageId);
    if (!targetMessage || targetMessage.conversation_id !== id) {
      return fail(res, 404, 'NOT_FOUND', 'الرسالة المستهدفة غير موجودة في هذه المحادثة');
    }

    const lastCustomerAt = conversation.last_customer_message_at
      ? new Date(conversation.last_customer_message_at).getTime()
      : null;
    const windowOpen = lastCustomerAt ? Date.now() - lastCustomerAt < SERVICE_WINDOW_MS : false;
    if (!windowOpen) {
      return fail(res, 422, 'TEMPLATE_REQUIRED', 'انتهت نافذة الـ24 ساعة. أرسل قالباً معتمداً لإعادة فتح المحادثة.');
    }

    const sendResult = await sendReactionMessage(conversation.wa_id, targetWaMessageId, emoji);
    const waMessageId = sendResult?.messages?.[0]?.id || null;

    const message = await recordOutboundMessage({
      conversationId: id,
      waMessageId,
      senderType: 'agent',
      sentBy: req.user.id,
      status: 'sent',
      messageType: 'reaction',
      reactionEmoji: emoji,
      reactedMessageWaId: targetWaMessageId,
    });

    await logAudit({ userId: req.user.id, conversationId: id, action: emoji ? 'send_reaction' : 'remove_reaction', metadata: { targetWaMessageId, emoji } });

    return res.status(201).json({ message });
  } catch (err) {
    console.error('[react] error:', err.message);
    return fail(res, 502, 'META_SEND_FAILED', 'تعذر إرسال التفاعل عبر واتساب');
  }
});
