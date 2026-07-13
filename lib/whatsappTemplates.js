const { graphGet, graphPost } = require('./metaGraph');

let ownNumberCache = null;

// The business's own WhatsApp number, derived from PHONE_NUMBER_ID (not an
// env var by itself, since Meta only exposes it via the phone number ID).
// Cached per warm serverless instance.
async function getOwnPhoneNumber() {
  if (ownNumberCache) return ownNumberCache;

  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const { status, body } = await graphGet(`/${phoneNumberId}`, { fields: 'display_phone_number' });
  if (status >= 400) {
    console.error('[whatsappTemplates] failed to fetch own number:', body?.error?.message);
    return null;
  }

  const digits = String(body.display_phone_number || '').replace(/\D/g, '');
  ownNumberCache = digits || null;
  return ownNumberCache;
}

async function sendTemplateMessage(to, templateName, languageCode, components) {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const { status, body } = await graphPost(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components || [],
    },
  });

  if (status >= 400 || body.error) {
    const err = new Error(body?.error?.message || 'Meta rejected the template message');
    err.metaError = body?.error;
    throw err;
  }
  return body;
}

module.exports = { getOwnPhoneNumber, sendTemplateMessage };
