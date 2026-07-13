const { Redis } = require('@upstash/redis');

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Claims `key` for `ttlSeconds`. Returns true the first time it's seen
// (caller should proceed), false on every repeat within the window (caller
// should treat it as a duplicate request). Fails open on Redis errors so an
// Upstash outage never silently blocks every send.
async function claimIdempotencyKey(key, ttlSeconds = 120) {
  try {
    const result = await kv.set(`idempotency:${key}`, '1', { nx: true, ex: ttlSeconds });
    return result === 'OK' || result === true;
  } catch (err) {
    console.error('[idempotency] error:', err.message);
    return true;
  }
}

module.exports = { claimIdempotencyKey };
