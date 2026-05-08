const { Redis } = require('@upstash/redis');
const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds
const KEY = (phone) => `session:${phone}`;

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in ms

function defaultSession() {
  return {
    step: 'language_selection', // language_selection | main_menu | ai_conversation
    language: null,             // 'ar' | 'en'
    department: null,           // selected department name
    history: [],                // [{role, content}] last N AI turns
    lastActivity: Date.now(),
  };
}

function isSessionExpired(session) {
  if (!session.lastActivity) return true;
  return Date.now() - session.lastActivity > INACTIVITY_TIMEOUT;
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

module.exports = { getSession, saveSession, clearSession, defaultSession, isSessionExpired };
