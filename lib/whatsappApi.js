const https = require('https');

async function sendMessage(to, text) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;

  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text, preview_url: false },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'graph.facebook.com',
        path: `/v19.0/${phoneNumberId}/messages`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              console.error('WhatsApp API error:', parsed.error);
            }
            resolve(parsed);
          } catch (e) {
            resolve(data);
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('WhatsApp request error:', err);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// Mark a message as read so the user sees the double blue tick
async function markAsRead(messageId) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;

  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'graph.facebook.com',
        path: `/v19.0/${phoneNumberId}/messages`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      }
    );
    req.on('error', resolve);
    req.write(payload);
    req.end();
  });
}

module.exports = { sendMessage, markAsRead };
