const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone } = require('../lib/phone');

test('normalizePhone accepts common international formats', () => {
  assert.equal(normalizePhone('+971 50-123 4567'), '971501234567');
  assert.equal(normalizePhone('00971501234567'), '971501234567');
  assert.equal(normalizePhone('971501234567'), '971501234567');
  assert.equal(normalizePhone('(20) 100-123-4567'), '201001234567');
});

test('normalizePhone rejects numbers without a country code or garbage input', () => {
  assert.equal(normalizePhone('0501234567'), null);
  assert.equal(normalizePhone('abc123'), null);
  assert.equal(normalizePhone('123'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone(null), null);
});
