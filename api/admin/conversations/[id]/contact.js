const { withAuth } = require('../../../../lib/authMiddleware');
const {
  getConversationById,
  recordOutboundMessage,
  touchConversationOnOutbound,
  logAudit,
} = require('../../../../lib/conversationService');
const { sendContactMessage } = require('../../../../lib/whatsappMedia');
const { checkMediaSendRateLimit } = require('../../../../lib/rateLimiter');
const { isValidUuid, sanitizeText } = require('../../../../lib/validation');

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function fail(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

function sanitizeContacts(contacts) {
  if (!Array.isArray(contacts) || !contacts.length) return null;
  return contacts
    .slice(0, 10)
    .map((c) => {
      const formattedName = sanitizeText(c?.name?.formatted_name, 200);
      if (!formattedName) return null;
      const phones = Array.isArray(c.phones)
        ? c.phones.slice(0, 5).map((p) => ({ phone: sanitizeText(p.phone, 32), type: sanitizeText(p.type, 20) || undefined }))
        : [];
      const emails = Array.isArray(c.emails)
        ? c.emails.slice(0, 5).map((e) => ({ email: sanitizeText(e.email, 200), type: sanitizeText(e.type, 20) || undefined }))
        : [];
      if (!phones.some((p) => p.phone)) return null;
      return { name: { formatted_name: formattedName }, phones: phones.filter((p) => p.phone), emails: emails.filter((e) => e.email) };
    })
    .filter(Boolean);
}

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  if (!isValidUuid(id)) return fail(res, 400, 'INVALID_REQUEST', 'معرف المحادثة غير صحيح');

  const contacts = sanitizeContacts(req.body?.contacts);
  if (!contacts) {
    return fail(res, 400, 'INVALID_REQUEST', 'يجب إدخال اسم ورقم هاتف صحيحين على الأقل لكل جهة اتصال');
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

    const sendResult = await sendContactMessage(conversation.wa_id, contacts);
    const waMessageId = sendResult?.messages?.[0]?.id || null;

    const message = await recordOutboundMessage({
      conversationId: id,
      waMessageId,
      senderType: 'agent',
      sentBy: req.user.id,
      status: 'sent',
      messageType: 'contacts',
      contactsData: contacts,
      text: contacts[0].name.formatted_name,
    });

    await touchConversationOnOutbound(id, { text: contacts[0].name.formatted_name, resetUnread: true });
    await logAudit({ userId: req.user.id, conversationId: id, action: 'send_contact' });

    return res.status(201).json({ message });
  } catch (err) {
    console.error('[contact] error:', err.message);
    return fail(res, 502, 'META_SEND_FAILED', 'تعذر إرسال جهة الاتصال عبر واتساب');
  }
});
