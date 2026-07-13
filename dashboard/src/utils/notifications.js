// Pure helpers for the notification system — kept dependency-free (no React,
// no DOM) so they're directly unit-testable.

const PREVIEW_MAX = 120;

// Compares two consecutive polls of the conversation list and returns only
// the conversations whose unread_count *increased* — i.e. a genuinely new
// inbound customer message arrived since the last poll. Comparing the
// counter (not message arrays) makes this naturally immune to duplicate
// polling results: if nothing changed server-side, unread_count is
// identical and nothing is reported twice.
export function detectNewInboundActivity(prevConversations, nextConversations) {
  const prevById = new Map((prevConversations || []).map((c) => [c.id, c]));
  const activity = [];

  for (const next of nextConversations || []) {
    const prev = prevById.get(next.id);
    const prevUnread = prev ? prev.unread_count : 0;
    if (next.unread_count > prevUnread) {
      activity.push({ conversation: next, deltaUnread: next.unread_count - prevUnread });
    }
  }

  return activity;
}

export function sumUnread(conversations) {
  return (conversations || []).reduce((total, c) => total + (c.unread_count || 0), 0);
}

// Notification API bodies are inserted as plain text by the browser (never
// parsed as HTML), so this is about length/noise, not XSS — just keep it
// short and single-line.
export function safePreview(text) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > PREVIEW_MAX ? clean.slice(0, PREVIEW_MAX - 1) + '…' : clean;
}

export function buildTabTitle(baseTitle, unreadTotal) {
  return unreadTotal > 0 ? `(${unreadTotal}) ${baseTitle}` : baseTitle;
}

// Web Push application server keys are base64url — the Push API needs a
// Uint8Array.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
