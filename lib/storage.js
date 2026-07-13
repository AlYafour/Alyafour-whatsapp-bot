const { put, del } = require('@vercel/blob');

// Thin storage abstraction so the rest of the app never imports
// @vercel/blob directly — swapping to another S3-compatible provider later
// only means changing this file.
async function uploadMedia({ key, buffer, contentType }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  }
  const blob = await put(key, buffer, {
    access: 'public',
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  // blob.url is never sent to the browser directly — the authenticated
  // /api/admin/media/:messageId endpoint fetches and streams it server-side.
  return { url: blob.url, key: blob.pathname };
}

async function deleteMedia(key) {
  try {
    await del(key, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    console.error('[storage] delete failed:', err.message);
  }
}

module.exports = { uploadMedia, deleteMedia };
