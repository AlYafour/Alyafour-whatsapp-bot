import { test } from 'node:test';
import assert from 'node:assert/strict';
import ar from '../src/locales/ar.json' with { type: 'json' };
import en from '../src/locales/en.json' with { type: 'json' };

function collectKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) return collectKeys(value, path);
    return [path];
  });
}

test('ar.json and en.json expose exactly the same translation keys', () => {
  const arKeys = collectKeys(ar).sort();
  const enKeys = collectKeys(en).sort();

  const missingInEn = arKeys.filter((k) => !enKeys.includes(k));
  const missingInAr = enKeys.filter((k) => !arKeys.includes(k));

  assert.deepEqual(missingInEn, [], `Keys present in ar.json but missing from en.json: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInAr, [], `Keys present in en.json but missing from ar.json: ${missingInAr.join(', ')}`);
});

test('no translation value is an empty string', () => {
  for (const [label, locale] of [['ar', ar], ['en', en]]) {
    for (const key of collectKeys(locale)) {
      const value = key.split('.').reduce((o, k) => o[k], locale);
      assert.notEqual(String(value).trim(), '', `${label}.json has an empty value at "${key}"`);
    }
  }
});
