// Reads a request body as a raw Buffer (for file uploads sent as the raw
// request body rather than multipart form fields — Vercel's Node runtime
// only auto-parses JSON/urlencoded/text, so binary content types arrive
// untouched on the stream).
function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error('Request body exceeds maximum allowed size'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = { readRawBody };
