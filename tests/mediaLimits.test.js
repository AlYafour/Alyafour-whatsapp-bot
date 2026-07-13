const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedMime, isWithinSizeLimit, sniffMimeType } = require('../lib/mediaLimits');

test('isAllowedMime enforces the official per-type allowlist', () => {
  assert.equal(isAllowedMime('image', 'image/jpeg'), true);
  assert.equal(isAllowedMime('image', 'image/gif'), false);
  assert.equal(isAllowedMime('video', 'video/mp4'), true);
  assert.equal(isAllowedMime('video', 'video/avi'), false);
  assert.equal(isAllowedMime('sticker', 'image/webp'), true);
  assert.equal(isAllowedMime('sticker', 'image/png'), false);
  assert.equal(isAllowedMime('audio', 'audio/ogg'), true);
  assert.equal(isAllowedMime('unknown-type', 'image/jpeg'), false);
});

test('isWithinSizeLimit enforces official per-type max sizes', () => {
  assert.equal(isWithinSizeLimit('image', 4 * 1024 * 1024), true);
  assert.equal(isWithinSizeLimit('image', 6 * 1024 * 1024), false);
  assert.equal(isWithinSizeLimit('sticker', 100 * 1024), true);
  assert.equal(isWithinSizeLimit('sticker', 600 * 1024), false);
  assert.equal(isWithinSizeLimit('document', 99 * 1024 * 1024), true);
  assert.equal(isWithinSizeLimit('document', 101 * 1024 * 1024), false);
  assert.equal(isWithinSizeLimit('image', 0), false);
});

test('sniffMimeType detects real file content regardless of declared type', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  const pdf = Buffer.from('%PDF-1.4 ...');
  const notAKnownFormat = Buffer.from([0x00, 0x01, 0x02, 0x03]);

  assert.equal(sniffMimeType(jpeg), 'image/jpeg');
  assert.equal(sniffMimeType(png), 'image/png');
  assert.equal(sniffMimeType(pdf), 'application/pdf');
  assert.equal(sniffMimeType(notAKnownFormat), null);
});
