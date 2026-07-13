const { Redis } = require('@upstash/redis');

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_ATTEMPTS = 8;

// Fixed-window counter keyed by IP+email. Fails open on Redis errors so an
// Upstash outage never permanently locks out every admin.
async function checkLoginRateLimit(key) {
  const redisKey = `ratelimit:login:${key}`;
  try {
    const count = await kv.incr(redisKey);
    if (count === 1) await kv.expire(redisKey, WINDOW_SECONDS);
    return count <= MAX_ATTEMPTS;
  } catch (err) {
    console.error('rateLimiter error:', err.message);
    return true;
  }
}

module.exports = { checkLoginRateLimit };
