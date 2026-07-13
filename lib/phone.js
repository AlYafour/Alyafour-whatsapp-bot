// Normalizes a user-entered phone number to bare E.164 digits (no leading
// "+"), e.g. "+971 50-123 4567" -> "971501234567". Returns null if the
// input can't be a valid international number — callers must already
// include the country code (we never guess one for a bare local number).
function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;

  let cleaned = raw.replace(/[\s\-()+]/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

  if (!/^[1-9]\d{7,14}$/.test(cleaned)) return null;
  return cleaned;
}

module.exports = { normalizePhone };
