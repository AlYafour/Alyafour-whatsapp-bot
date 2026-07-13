const https = require('https');
const { graphGet } = require('./metaGraph');

const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // Meta's own ceiling across all media types

function httpsGetBuffer(url, headers, maxBytes) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 400) {
        res.resume();
        reject(new Error(`Media download failed with status ${res.statusCode}`));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          res.destroy();
          reject(new Error('Media exceeds maximum allowed size'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// Meta media URLs are short-lived (~5 min) and require the same Bearer
// token as every other Graph API call — never expose this URL or the
// token to the browser.
async function fetchMetaMedia(mediaId) {
  const { status, body } = await graphGet(`/${mediaId}`);
  if (status >= 400 || !body.url) {
    const err = new Error(body?.error?.message || 'Failed to fetch media metadata from Meta');
    err.metaError = body?.error;
    throw err;
  }

  const buffer = await httpsGetBuffer(
    body.url,
    { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    MAX_DOWNLOAD_BYTES
  );

  return {
    buffer,
    mimeType: body.mime_type,
    fileSize: Number(body.file_size) || buffer.length,
    sha256: body.sha256,
  };
}

module.exports = { fetchMetaMedia, MAX_DOWNLOAD_BYTES };
