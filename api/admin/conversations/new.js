const crypto = require('crypto');
const { withAuth } = require('../../../lib/authMiddleware');
const { normalizePhone } = require('../../../lib/phone');
const { getOwnPhoneNumber, sendTemplateMessage } = require('../../../lib/whatsappTemplates');
const { listApprovedTemplates, findTemplateLanguage, validateComponents, renderPreview } = require('../../../lib/templateService');
const {
  getOrCreateConversation,
  assignHumanForAgentInitiated,
  recordOutboundMessage,
  touchConversationOnOutbound,
  logAudit,
} = require('../../../lib/conversationService');
const { checkTemplateSendRateLimit } = require('../../../lib/rateLimiter');
const { claimIdempotencyKey } = require('../../../lib/idempotency');
const { sanitizeText } = require('../../../lib/validation');

const MAX_NAME_LEN = 200;
const MAX_TEMPLATE_NAME_LEN = 512;

function fail(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

module.exports = withAuth(
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const rateOk = await checkTemplateSendRateLimit(req.user.id);
    if (!rateOk) {
      return fail(res, 429, 'RATE_LIMITED', 'عدد كبير جداً من المحاولات، يرجى المحاولة لاحقاً');
    }

    const phoneRaw = sanitizeText(req.body?.phone, 32);
    const customerName = sanitizeText(req.body?.customerName, MAX_NAME_LEN) || null;
    const templateName = sanitizeText(req.body?.templateName, MAX_TEMPLATE_NAME_LEN);
    const languageCode = sanitizeText(req.body?.languageCode, 16);
    const components = Array.isArray(req.body?.components) ? req.body.components : [];

    if (!templateName || !languageCode) {
      return fail(res, 400, 'TEMPLATE_PARAMETERS_REQUIRED', 'يجب اختيار القالب واللغة');
    }

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return fail(res, 400, 'INVALID_PHONE', 'رقم الهاتف غير صحيح. أدخل الرقم بالصيغة الدولية، مثال: 971501234567');
    }

    let ownNumber = null;
    try {
      ownNumber = await getOwnPhoneNumber();
    } catch {
      ownNumber = null;
    }
    if (ownNumber && phone === ownNumber) {
      return fail(res, 400, 'INVALID_PHONE', 'لا يمكن إرسال رسالة إلى رقم واتساب الشركة نفسه');
    }

    // Idempotency: prefer a client-supplied key (one per modal session) so a
    // genuine retry of the exact same click can't double-send; fall back to
    // a short payload-derived window to guard a bare double-click.
    const clientKey = sanitizeText(req.headers['idempotency-key'], 128);
    const idemKey =
      clientKey ||
      crypto
        .createHash('sha256')
        .update(`${req.user.id}:${phone}:${templateName}:${languageCode}:${JSON.stringify(components)}`)
        .digest('hex');
    const ttl = clientKey ? 120 : 5;

    const claimed = await claimIdempotencyKey(idemKey, ttl);
    if (!claimed) {
      return fail(res, 409, 'DUPLICATE_REQUEST', 'تم إرسال هذا الطلب بالفعل');
    }

    let templates;
    try {
      templates = await listApprovedTemplates();
    } catch (err) {
      console.error('[conversations/new] template fetch error:', err.message);
      return fail(res, 502, 'META_FETCH_FAILED', 'تعذر التحقق من حالة القالب لدى Meta');
    }

    const { template, language } = findTemplateLanguage(templates, templateName, languageCode);
    if (!template) {
      return fail(res, 400, 'TEMPLATE_NOT_APPROVED', 'القالب غير موجود أو غير معتمد');
    }
    if (!language) {
      return fail(res, 400, 'TEMPLATE_LANGUAGE_NOT_FOUND', 'اللغة المختارة غير متوفرة لهذا القالب');
    }

    const validation = validateComponents(language, components);
    if (!validation.valid) {
      return fail(res, 400, 'TEMPLATE_PARAMETERS_REQUIRED', validation.missing.join('، '));
    }

    let sendResult;
    try {
      sendResult = await sendTemplateMessage(phone, templateName, languageCode, components);
    } catch (err) {
      console.error('[conversations/new] Meta send error:', err.message);
      return fail(res, 502, 'META_SEND_FAILED', err.message || 'تعذر إرسال القالب عبر واتساب');
    }

    const waMessageId = sendResult?.messages?.[0]?.id || null;
    const previewText = renderPreview(language, components);

    try {
      const conversation = await getOrCreateConversation(phone, customerName);
      const updatedConversation = await assignHumanForAgentInitiated(conversation.id, req.user.id);

      const message = await recordOutboundMessage({
        conversationId: conversation.id,
        waMessageId,
        senderType: 'agent',
        text: previewText,
        sentBy: req.user.id,
        status: 'sent',
        messageType: 'template',
        templateName,
        templateLanguage: languageCode,
        rawPayload: { templateName, languageCode, components },
      });

      await touchConversationOnOutbound(conversation.id, { text: previewText, resetUnread: false });
      await logAudit({
        userId: req.user.id,
        conversationId: conversation.id,
        action: 'send_template',
        metadata: { templateName, languageCode, phone, messageId: waMessageId },
      });

      return res.status(201).json({ conversation: updatedConversation, message });
    } catch (err) {
      // The WhatsApp message already went out at this point — log loudly so
      // ops can reconcile, but don't pretend to the client that it failed.
      console.error('[conversations/new] post-send persistence error:', err.message);
      return fail(res, 500, 'INTERNAL_ERROR', 'تم إرسال الرسالة لكن حدث خطأ أثناء حفظ المحادثة، يرجى تحديث الصفحة');
    }
  },
  { roles: ['admin', 'agent'] }
);
