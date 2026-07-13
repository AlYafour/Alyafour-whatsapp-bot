const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'test-token';
const { validateComponents, renderPreview, extractPlaceholderCount } = require('../lib/templateService');

const languageDef = {
  languageCode: 'ar',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'مرحباً {{1}}', variablesCount: 1, requiresMedia: false },
    { type: 'BODY', text: 'طلبك رقم {{1}} جاهز بتاريخ {{2}}', variablesCount: 2 },
    { type: 'FOOTER', text: 'شكراً لتعاملكم معنا' },
    { type: 'BUTTONS', buttons: [{ index: 0, type: 'URL', text: 'تتبع', url: 'https://x.com/{{1}}', variablesCount: 1 }] },
  ],
};

test('extractPlaceholderCount counts unique {{n}} placeholders', () => {
  assert.equal(extractPlaceholderCount('Hello {{1}}, order {{2}} ready. {{1}} again'), 2);
  assert.equal(extractPlaceholderCount(null), 0);
});

test('validateComponents rejects a template send missing every required variable', () => {
  const result = validateComponents(languageDef, []);
  assert.equal(result.valid, false);
  assert.equal(result.missing.length, 3);
});

test('validateComponents accepts a fully-populated components payload', () => {
  const components = [
    { type: 'header', parameters: [{ type: 'text', text: 'أحمد' }] },
    { type: 'body', parameters: [{ type: 'text', text: '123' }, { type: 'text', text: '2026-07-13' }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'abc' }] },
  ];
  const result = validateComponents(languageDef, components);
  assert.equal(result.valid, true);
  assert.deepEqual(result.missing, []);
});

test('validateComponents flags a missing button parameter alone', () => {
  const components = [
    { type: 'header', parameters: [{ type: 'text', text: 'أحمد' }] },
    { type: 'body', parameters: [{ type: 'text', text: '123' }, { type: 'text', text: '2026-07-13' }] },
  ];
  const result = validateComponents(languageDef, components);
  assert.equal(result.valid, false);
  assert.equal(result.missing.length, 1);
});

test('renderPreview substitutes variables into header/body/footer', () => {
  const components = [
    { type: 'header', parameters: [{ type: 'text', text: 'أحمد' }] },
    { type: 'body', parameters: [{ type: 'text', text: '123' }, { type: 'text', text: '2026-07-13' }] },
  ];
  const preview = renderPreview(languageDef, components);
  assert.match(preview, /أحمد/);
  assert.match(preview, /123/);
  assert.match(preview, /شكراً/);
});
