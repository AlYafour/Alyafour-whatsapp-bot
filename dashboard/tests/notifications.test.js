import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectNewInboundActivity, sumUnread, safePreview, buildTabTitle } from '../src/utils/notifications.js';

test('detectNewInboundActivity reports only conversations whose unread_count increased', () => {
  const prev = [
    { id: 'a', unread_count: 0 },
    { id: 'b', unread_count: 2 },
  ];
  const next = [
    { id: 'a', unread_count: 1 },
    { id: 'b', unread_count: 2 },
  ];
  const result = detectNewInboundActivity(prev, next);
  assert.equal(result.length, 1);
  assert.equal(result[0].conversation.id, 'a');
  assert.equal(result[0].deltaUnread, 1);
});

test('detectNewInboundActivity is a no-op when a poll returns identical data (dedup)', () => {
  const list = [{ id: 'a', unread_count: 3 }];
  // Same reference AND a fresh equivalent object both must produce no activity.
  assert.equal(detectNewInboundActivity(list, list).length, 0);
  assert.equal(detectNewInboundActivity(list, [{ id: 'a', unread_count: 3 }]).length, 0);
});

test('detectNewInboundActivity treats a brand-new conversation with unread as new activity', () => {
  const result = detectNewInboundActivity([], [{ id: 'z', unread_count: 1 }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].conversation.id, 'z');
});

test('detectNewInboundActivity ignores a decrease (e.g. an agent marked it read elsewhere)', () => {
  const prev = [{ id: 'a', unread_count: 3 }];
  const next = [{ id: 'a', unread_count: 0 }];
  assert.equal(detectNewInboundActivity(prev, next).length, 0);
});

test('sumUnread totals unread_count across every conversation', () => {
  assert.equal(sumUnread([{ unread_count: 2 }, { unread_count: 0 }, { unread_count: 5 }]), 7);
  assert.equal(sumUnread([]), 0);
});

test('safePreview truncates long text to a single-line summary', () => {
  const long = 'a'.repeat(200);
  const preview = safePreview(long);
  assert.ok(preview.length <= 120);
  assert.ok(preview.endsWith('…'));
});

test('buildTabTitle prefixes the unread count only when it is greater than zero', () => {
  assert.equal(buildTabTitle('Dashboard', 0), 'Dashboard');
  assert.equal(buildTabTitle('Dashboard', 3), '(3) Dashboard');
});
