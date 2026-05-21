/** Shared Redis connection config for BullMQ (supports REDIS_URL or REDIS_HOST/PORT). */
function getRedisConnection() {
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      const connection = {
        host: url.hostname,
        port: Number(url.port) || 6379,
      };
      if (url.password) connection.password = url.password;
      return connection;
    } catch {
      // fall through
    }
  }
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
  };
}

module.exports = { getRedisConnection };
