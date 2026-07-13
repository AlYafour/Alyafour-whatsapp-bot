const { withAuth } = require('../../../../lib/authMiddleware');
const {
  getConversationById,
  recordOutboundMessage,
  touchConversationOnOutbound,
  logAudit,
} = require('../../../../lib/conversationService');
const { sendLocationMessage } = require('../../../../lib/whatsappMedia');
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

  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  const name = sanitizeText(req.body?.name, 200) || null;
  const address = sanitizeText(req.body?.address, 300) || null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return fail(res, 400, 'INVALID_REQUEST', 'إحداثيات الموقع غير صحيحة');
  }

  const rateOk = await checkMediaSendRateLimit(req.user.id);
  if (!rateOk) return fail(res, 429, 'RATE_LIMITED', 'عدد كبير جداً من المحاولات، حاول لاحقاً');

  try {
    const conversation = await getConversationById(id);
    if (!conversation) return fail(res, 404, 'NOT_FOUND', 'المحادثة غير موجودة');

    const lastCustomerAt = conversation.last_customer_message_at
      ? new Date(conversation.last_customer_message_at).getTime()
      : null;
    const windowOpen = lastCustomerAt ? Date.now() - lastCustomerAt < SERVICE_WINDOW_MS : false;
    if (!windowOpen) {
      return fail(res, 422, 'TEMPLATE_REQUIRED', 'انتهت نافذة الـ24 ساعة. أرسل قالباً معتمداً لإعادة فتح المحادثة.');
    }

    const sendResult = await sendLocationMessage(conversation.wa_id, { latitude, longitude, name, address });
    const waMessageId = sendResult?.messages?.[0]?.id || null;

    const message = await recordOutboundMessage({
      conversationId: id,
      waMessageId,
      senderType: 'agent',
      sentBy: req.user.id,
      status: 'sent',
      messageType: 'location',
      latitude,
      longitude,
      locationName: name,
      locationAddress: address,
      text: name || address,
    });

    await touchConversationOnOutbound(id, { text: name || 'موقع', resetUnread: true });
    await logAudit({ userId: req.user.id, conversationId: id, action: 'send_location', metadata: { latitude, longitude } });

    return res.status(201).json({ message });
  } catch (err) {
    console.error('[location] error:', err.message);
    return fail(res, 502, 'META_SEND_FAILED', 'تعذر إرسال الموقع عبر واتساب');
  }
});
