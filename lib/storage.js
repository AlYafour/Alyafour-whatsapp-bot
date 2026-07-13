const { put, del } = require('@vercel/blob');

// Thin storage abstraction so the rest of the app never imports
// @vercel/blob directly — swapping to another S3-compatible provider later
// only means changing this file.

// On Vercel, connecting the Blob store to the project populates
// BLOB_STORE_ID and VERCEL_OIDC_TOKEN automatically on every deployment.
// Those are short-lived/auto-rotated, so they're preferred over the
// long-lived BLOB_READ_WRITE_TOKEN whenever both are present.
function hasOidcCredentials() {
  return !!(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN);
}

// Resolves the auth option to pass to the SDK. Passing an explicit `token`
// always wins over OIDC in @vercel/blob's resolution order, so we must only
// pass one when OIDC credentials aren't available — i.e. local development,
// where `vercel env pull` typically only pulls BLOB_READ_WRITE_TOKEN.
function resolveAuthOptions() {
  if (hasOidcCredentials()) return {}; // let the SDK read BLOB_STORE_ID/VERCEL_OIDC_TOKEN itself

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return { token: process.env.BLOB_READ_WRITE_TOKEN };
  }

  throw new Error(
    'No Vercel Blob credentials available. On Vercel, connect a Blob store to this project ' +
      '(populates BLOB_STORE_ID/VERCEL_OIDC_TOKEN automatically). For local development, set ' +
      'BLOB_READ_WRITE_TOKEN instead.'
  );
}

async function uploadMedia({ key, buffer, contentType }) {
  const blob = await put(key, buffer, {
    access: 'public',
    contentType,
    ...resolveAuthOptions(),
  });
  // blob.url is never sent to the browser directly — the authenticated
  // /api/admin/media/:messageId endpoint fetches and streams it server-side.
  return { url: blob.url, key: blob.pathname };
}

async function deleteMedia(key) {
  try {
    await del(key, resolveAuthOptions());
  } catch (err) {
    console.error('[storage] delete failed:', err.message);
  }
}

module.exports = { uploadMedia, deleteMedia };
