const https = require('https');

const API_VERSION = 'v19.0';

// Thin, dependency-free wrapper around the Meta Graph API (GET + POST),
// shared by template listing/sending. Never logs the access token.
function request(method, path, { params, body } = {}) {
  return new Promise((resolve, reject) => {
    let fullPath = `/${API_VERSION}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) fullPath += `?${qs}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    const headers = { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request({ hostname: 'graph.facebook.com', path: fullPath, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, body: {} });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const graphGet = (path, params) => request('GET', path, { params });
const graphPost = (path, body) => request('POST', path, { body });

module.exports = { graphGet, graphPost };
