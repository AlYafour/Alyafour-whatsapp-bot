const { graphPost } = require('./metaGraph');
const https = require('https');

// Meta's media upload endpoint needs real multipart/form-data — built by
// hand here rather than pulling in a multipart dependency for one call.
function buildMultipart(buffer, mimeType, filename) {
  const boundary = `----ayw${Date.now()}${Math.random().toString(16).slice(2)}`;
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat([pre, buffer, post]), contentType: `multipart/form-data; boundary=${boundary}` };
}

function uploadMediaToMeta(buffer, mimeType, filename) {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const { body, contentType } = buildMultipart(buffer, mimeType, filename || 'file');

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'graph.facebook.com',
        path: `/v19.0/${phoneNumberId}/media`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': contentType,
          'Content-Length': body.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error.message || 'Meta media upload failed'));
            resolve(parsed.id);
          } catch {
            reject(new Error('Meta media upload returned an unexpected response'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendMediaMessage(to, messageType, mediaId, { caption, filename } = {}) {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const payload = { id: mediaId };
  if (caption) payload.caption = caption;
  if (messageType === 'document' && filename) payload.filename = filename;

  const apiType = messageType === 'voice' ? 'audio' : messageType;
  const { status, body } = await graphPost(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: apiType,
    [apiType]: payload,
  });
  if (status >= 400 || body.error) {
    throw new Error(body?.error?.message || 'Meta rejected the media message');
  }
  return body;
}

async function sendLocationMessage(to, { latitude, longitude, name, address }) {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const { status, body } = await graphPost(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'location',
    location: { latitude, longitude, name: name || undefined, address: address || undefined },
  });
  if (status >= 400 || body.error) throw new Error(body?.error?.message || 'Meta rejected the location message');
  return body;
}

async function sendContactMessage(to, contacts) {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const { status, body } = await graphPost(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'contacts',
    contacts,
  });
  if (status >= 400 || body.error) throw new Error(body?.error?.message || 'Meta rejected the contact message');
  return body;
}

// emoji: '' removes a previously-sent reaction.
async function sendReactionMessage(to, targetWaMessageId, emoji) {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const { status, body } = await graphPost(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'reaction',
    reaction: { message_id: targetWaMessageId, emoji: emoji || '' },
  });
  if (status >= 400 || body.error) throw new Error(body?.error?.message || 'Meta rejected the reaction');
  return body;
}

module.exports = { uploadMediaToMeta, sendMediaMessage, sendLocationMessage, sendContactMessage, sendReactionMessage };
