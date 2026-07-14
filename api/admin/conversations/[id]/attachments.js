const crypto = require('crypto');
const { withAuth } = require('../../../../lib/authMiddleware');
const { readRawBody } = require('../../../../lib/rawBody');
const {
  getConversationById,
  recordOutboundMessage,
  touchConversationOnOutbound,
  logAudit,
} = require('../../../../lib/conversationService');
const { uploadMediaToMeta, sendMediaMessage } = require('../../../../lib/whatsappMedia');
const { uploadMedia } = require('../../../../lib/storage');
const { getLimits, isAllowedMime, isWithinSizeLimit, sniffMimeType } = require('../../../../lib/mediaLimits');
const { checkMediaSendRateLimit } = require('../../../../lib/rateLimiter');
const { claimIdempotencyKey } = require('../../../../lib/idempotency');
const { isValidUuid, sanitizeText } = require('../../../../lib/validation');

// Agents upload the raw file bytes as the request body (Content-Type: the
// file's mime type). Metadata travels via query params — this avoids
// needing a multipart/form-data parser dependency for a single endpoint.
const ALLOWED_TYPES = ['image', 'video', 'document', 'audio', 'voice', 'sticker'];
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function fail(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

function decodeParam(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

module.exports = withAuth(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!isValidUuid(id)) return fail(res, 400, 'INVALID_REQUEST', 'معرف المحادثة غير صحيح');

  const messageType = String(req.query.type || '').toLowerCase();
  if (!ALLOWED_TYPES.includes(messageType)) {
    return fail(res, 400, 'INVALID_REQUEST', 'نوع المرفق غير مدعوم');
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
      return fail(
        res,
        422,
        'TEMPLATE_REQUIRED',
        'انتهت نافذة الـ24 ساعة لهذه المحادثة. أرسل قالباً معتمداً لإعادة فتحها قبل إرسال مرفقات حرة.'
      );
    }

    const limits = getLimits(messageType);
    const buffer = await readRawBody(req, limits.maxBytes + 1024);
    if (!buffer.length) return fail(res, 400, 'INVALID_REQUEST', 'الملف فارغ');

    const declaredMime = String(req.headers['content-type'] || '').split(';')[0].trim();
    const sniffed = sniffMimeType(buffer);
    const effectiveMime = (sniffed && isAllowedMime(messageType, sniffed) ? sniffed : null) || declaredMime;

    if (!isAllowedMime(messageType, effectiveMime)) {
      return fail(res, 400, 'UNSUPPORTED_MEDIA_TYPE', `نوع الملف غير مدعوم لرسائل ${messageType}`);
    }
    if (!isWithinSizeLimit(messageType, buffer.length)) {
      return fail(res, 400, 'FILE_TOO_LARGE', 'حجم الملف يتجاوز الحد المسموح به من واتساب لهذا النوع');
    }

    const clientKey = sanitizeText(req.headers['idempotency-key'], 128);
    const idemKey =
      clientKey ||
      crypto.createHash('sha256').update(`${req.user.id}:${id}:${messageType}:${buffer.length}`).digest('hex');
    const claimed = await claimIdempotencyKey(idemKey, clientKey ? 120 : 5);
    if (!claimed) return fail(res, 409, 'DUPLICATE_REQUEST', 'تم إرسال هذا الطلب بالفعل');

    const filename = sanitizeText(decodeParam(req.query.filename), 200) || `file-${Date.now()}`;
    const caption = sanitizeText(decodeParam(req.query.caption), 1024) || null;
    const contextMessageWaId = sanitizeText(req.query.contextMessageWaId, 128) || null;

    const mediaId = await uploadMediaToMeta(buffer, effectiveMime, filename);
    const sendResult = await sendMediaMessage(conversation.wa_id, messageType, mediaId, {
      caption: caption || undefined,
      filename,
    });
    const waMessageId = sendResult?.messages?.[0]?.id || null;

    // Best-effort archive of our own copy — Meta's media retention is
    // short-lived, this is what backs re-viewing a sent attachment later.
    let storageKey = null;
    let storageUrl = null;
    try {
      const stored = await uploadMedia({ key: `conversations/${id}/out-${Date.now()}`, buffer, contentType: effectiveMime });
      storageKey = stored.key;
      storageUrl = stored.url;
    } catch (err) {
      console.error('[attachments] archive upload failed (non-fatal):', err.message);
    }

    const message = await recordOutboundMessage({
      conversationId: id,
      waMessageId,
      senderType: 'agent',
      sentBy: req.user.id,
      status: 'sent',
      messageType,
      caption,
      filename,
      fileSize: buffer.length,
      mimeType: effectiveMime,
      storageKey,
      storageUrl,
      // Keep Meta's media id so the media proxy can lazily re-download the
      // file even when the blob archive fails (e.g. missing credentials).
      mediaId,
      mediaStatus: storageUrl ? 'stored' : 'pending',
      contextMessageWaId,
      text: caption,
    });

    await touchConversationOnOutbound(id, { text: caption || `[${messageType}]`, resetUnread: true });
    await logAudit({
      userId: req.user.id,
      conversationId: id,
      action: 'send_attachment',
      metadata: { messageType, filename, fileSize: buffer.length },
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error('[attachments] error:', err.message);
    return fail(res, 502, 'META_SEND_FAILED', 'تعذر إرسال المرفق عبر واتساب');
  }
});
