const { kv } = require('@vercel/kv');

const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds
const KEY = (phone) => `session:${phone}`;

function defaultSession() {
  return {
    step: 'language_selection', // language_selection | main_menu | ai_conversation
    language: null,             // 'ar' | 'en'
    department: null,           // selected department name
    history: [],                // [{role, content}] last N AI turns
  };
}

async function getSession(phone) {
  try {
    const session = await kv.get(KEY(phone));
    return session || defaultSession();
  } catch (err) {
    console.error('getSession error:', err.message);
    return defaultSession();
  }
}

async function saveSession(phone, session) {
  try {
    await kv.set(KEY(phone), session, { ex: SESSION_TTL });
  } catch (err) {
    console.error('saveSession error:', err.message);
  }
}

async function clearSession(phone) {
  try {
    await kv.del(KEY(phone));
  } catch (err) {
    console.error('clearSession error:', err.message);
  }
}

module.exports = { getSession, saveSession, clearSession, defaultSession };
