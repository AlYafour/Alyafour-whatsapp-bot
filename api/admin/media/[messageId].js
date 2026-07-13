const https = require('https');
const { withAuth } = require('../../../lib/authMiddleware');
const { getMessageById, getConversationById, updateMessageMediaStorage } = require('../../../lib/conversationService');
const { fetchMetaMedia } = require('../../../lib/mediaDownload');
const { uploadMedia } = require('../../../lib/storage');
const { isAllowedMime, isWithinSizeLimit } = require('../../../lib/mediaLimits');
const { isValidUuid } = require('../../../lib/validation');

const INLINE_TYPES = ['image', 'video', 'audio', 'voice', 'sticker'];

function sanitizeFilename(name) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 150);
}

function streamFromStorage(message, res) {
  return new Promise((resolve) => {
    https
      .get(message.storage_url, (upstream) => {
        if (upstream.statusCode >= 400) {
          upstream.resume();
          res.status(502).json({ error: 'MEDIA_UNAVAILABLE', message: 'تعذر الوصول إلى الملف المخزّن' });
          return resolve();
        }
        res.setHeader('Content-Type', message.mime_type || 'application/octet-stream');
        if (message.file_size) res.setHeader('Content-Length', String(message.file_size));
        const disposition = INLINE_TYPES.includes(message.message_type) ? 'inline' : 'attachment';
        const filename = sanitizeFilename(message.filename || `${message.message_type}-${message.id}`);
        res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
        res.status(200);
        upstream.pipe(res);
        upstream.on('end', resolve);
        upstream.on('error', resolve);
      })
      .on('error', () => {
        res.status(502).json({ error: 'MEDIA_UNAVAILABLE', message: 'تعذر الوصول إلى الملف المخزّن' });
        resolve();
      });
  });
}

// Authenticated media proxy: never exposes the Meta access token or the raw
// Meta/blob URL to the browser. Downloads from Meta lazily on first access
// (webhook persistence only stores metadata — see api/webhook.js), then
// serves from object storage on every subsequent request.
module.exports = withAuth(async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { messageId } = req.query;
  if (!isValidUuid(messageId)) return res.status(400).json({ error: 'INVALID_REQUEST' });

  try {
    let message = await getMessageById(messageId);
    if (!message || (!message.media_id && !message.storage_url)) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'لا يوجد ملف مرفق بهذه الرسالة' });
    }

    const conversation = await getConversationById(message.conversation_id);
    if (!conversation) return res.status(404).json({ error: 'NOT_FOUND' });

    if (message.media_status !== 'stored' || !message.storage_url) {
      try {
        const { buffer, mimeType, fileSize, sha256 } = await fetchMetaMedia(message.media_id);
        const effectiveMime = message.mime_type || mimeType;

        if (!isAllowedMime(message.message_type, effectiveMime)) {
          throw new Error('Downloaded media type is not in the allowed list');
        }
        if (!isWithinSizeLimit(message.message_type, fileSize || buffer.length)) {
          throw new Error('Downloaded media exceeds the allowed size');
        }

        const stored = await uploadMedia({
          key: `conversations/${message.conversation_id}/${message.id}`,
          buffer,
          contentType: effectiveMime,
        });

        message = await updateMessageMediaStorage(message.id, {
          storageKey: stored.key,
          storageUrl: stored.url,
          mediaStatus: 'stored',
          mediaError: null,
          fileSize: fileSize || buffer.length,
          mimeType: effectiveMime,
          sha256,
        });
      } catch (err) {
        console.error('[admin/media] download failed:', err.message);
        await updateMessageMediaStorage(message.id, { mediaStatus: 'failed', mediaError: 'DOWNLOAD_FAILED' });
        return res.status(502).json({
          error: 'MEDIA_DOWNLOAD_FAILED',
          message: 'تعذر تحميل هذا الملف. يمكنك إعادة المحاولة.',
          retriable: true,
        });
      }
    }

    return streamFromStorage(message, res);
  } catch (err) {
    console.error('[admin/media] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
