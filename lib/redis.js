/** BullMQ / ioredis connection — prefer full REDIS_URL (Upstash rediss://). */
function getRedisConnection() {
  const raw = process.env.REDIS_URL?.trim();

  if (raw) {
    try {
      const url = new URL(raw);
      console.log(`[Redis] Using REDIS_URL → ${url.protocol}//${url.hostname}:${url.port || 6379}`);
      // ioredis accepts URL string (handles TLS for rediss://)
      return raw;
    } catch (err) {
      console.error('[Redis] Invalid REDIS_URL:', err.message);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('[Redis] FATAL: REDIS_URL not set on Render — add Upstash TCP URL, remove REDIS_HOST');
  }

  console.warn('[Redis] Fallback to', process.env.REDIS_HOST || '127.0.0.1', process.env.REDIS_PORT || 6379);
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
  };
}

module.exports = { getRedisConnection };
