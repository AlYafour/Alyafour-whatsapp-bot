const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function stripControlChars(value) {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 32 || code === 9) out += value[i];
  }
  return out;
}

function sanitizeText(value, maxLen = 4096) {
  if (typeof value !== 'string') return '';
  return stripControlChars(value).trim().slice(0, maxLen);
}

module.exports = { isValidEmail, isValidUuid, sanitizeText };
