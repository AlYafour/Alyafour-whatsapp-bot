const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fakeBareModule } = require('./helpers/fakeModule');

let lastPutOptions = null;
fakeBareModule('@vercel/blob', {
  put: async (key, buffer, options) => {
    lastPutOptions = options;
    return { url: 'https://example.blob.vercel-storage.com/' + key, pathname: key };
  },
  del: async () => {},
});

const storage = require('../lib/storage');

function resetEnv() {
  delete process.env.BLOB_STORE_ID;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
}

test('uses Vercel OIDC (no explicit token) when BLOB_STORE_ID + VERCEL_OIDC_TOKEN are present', async () => {
  resetEnv();
  process.env.BLOB_STORE_ID = 'store_123';
  process.env.VERCEL_OIDC_TOKEN = 'oidc-token';

  await storage.uploadMedia({ key: 'k1', buffer: Buffer.from('x'), contentType: 'image/jpeg' });
  assert.equal(lastPutOptions.token, undefined);
});

test('falls back to BLOB_READ_WRITE_TOKEN for local development when OIDC vars are absent', async () => {
  resetEnv();
  process.env.BLOB_READ_WRITE_TOKEN = 'rw-token';

  await storage.uploadMedia({ key: 'k2', buffer: Buffer.from('x'), contentType: 'image/jpeg' });
  assert.equal(lastPutOptions.token, 'rw-token');
});

test('prefers OIDC over BLOB_READ_WRITE_TOKEN when both happen to be present', async () => {
  resetEnv();
  process.env.BLOB_STORE_ID = 'store_123';
  process.env.VERCEL_OIDC_TOKEN = 'oidc-token';
  process.env.BLOB_READ_WRITE_TOKEN = 'rw-token';

  await storage.uploadMedia({ key: 'k3', buffer: Buffer.from('x'), contentType: 'image/jpeg' });
  assert.equal(lastPutOptions.token, undefined);
});

test('does not require BLOB_STORE_ID alone or VERCEL_OIDC_TOKEN alone — both must be present for OIDC', async () => {
  resetEnv();
  process.env.BLOB_STORE_ID = 'store_123'; // no VERCEL_OIDC_TOKEN
  process.env.BLOB_READ_WRITE_TOKEN = 'rw-token';

  await storage.uploadMedia({ key: 'k4', buffer: Buffer.from('x'), contentType: 'image/jpeg' });
  assert.equal(lastPutOptions.token, 'rw-token');
});

test('throws a clear error when neither OIDC nor BLOB_READ_WRITE_TOKEN is available', async () => {
  resetEnv();
  await assert.rejects(
    () => storage.uploadMedia({ key: 'k5', buffer: Buffer.from('x'), contentType: 'image/jpeg' }),
    /No Vercel Blob credentials/
  );
});

test('deleteMedia never throws even when credentials are missing (best-effort cleanup)', async () => {
  resetEnv();
  await storage.deleteMedia('some-key'); // caught internally — must not reject
});
