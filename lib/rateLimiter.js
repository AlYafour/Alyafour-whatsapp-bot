const { Redis } = require('@upstash/redis');

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const LOGIN_WINDOW_SECONDS = 15 * 60; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 8;

const TEMPLATE_SEND_WINDOW_SECONDS = 5 * 60; // 5 minutes
const TEMPLATE_SEND_MAX_ATTEMPTS = 20;

// Fixed-window counter. Fails open on Redis errors so an Upstash outage
// never permanently locks out every admin/agent.
async function checkRateLimit(namespace, key, { windowSeconds, maxAttempts }) {
  const redisKey = `ratelimit:${namespace}:${key}`;
  try {
    const count = await kv.incr(redisKey);
    if (count === 1) await kv.expire(redisKey, windowSeconds);
    return count <= maxAttempts;
  } catch (err) {
    console.error('rateLimiter error:', err.message);
    return true;
  }
}

const checkLoginRateLimit = (key) =>
  checkRateLimit('login', key, { windowSeconds: LOGIN_WINDOW_SECONDS, maxAttempts: LOGIN_MAX_ATTEMPTS });

const checkTemplateSendRateLimit = (key) =>
  checkRateLimit('template-send', key, {
    windowSeconds: TEMPLATE_SEND_WINDOW_SECONDS,
    maxAttempts: TEMPLATE_SEND_MAX_ATTEMPTS,
  });

module.exports = { checkLoginRateLimit, checkTemplateSendRateLimit };
