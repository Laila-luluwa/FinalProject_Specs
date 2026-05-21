/** Shared Redis connection config for BullMQ (REDIS_URL, Upstash rediss://, or REDIS_HOST/PORT). */
function getRedisConnection() {
  const raw = process.env.REDIS_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      const connection = {
        host: url.hostname,
        port: Number(url.port) || 6379,
        maxRetriesPerRequest: null,
      };
      if (url.username) connection.username = decodeURIComponent(url.username);
      if (url.password) connection.password = decodeURIComponent(url.password);
      if (url.protocol === 'rediss:') {
        connection.tls = {};
      }
      return connection;
    } catch (err) {
      console.error('[Redis] Invalid REDIS_URL:', err.message);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[Redis] REDIS_URL is missing or invalid — set Upstash URL in hosting env (not 127.0.0.1)'
    );
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
  };
}

module.exports = { getRedisConnection };
