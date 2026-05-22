/** BullMQ / ioredis — use full REDIS_URL (Upstash rediss://). Never localhost on Render/Docker. */
function isHostedRuntime() {
  return (
    process.env.DOCKER_COMPOSE === '1'
    || process.env.RENDER === 'true'
    || Boolean(process.env.RENDER_SERVICE_ID)
    || process.env.NODE_ENV === 'production'
  );
}

function getRedisConnection() {
  if (process.env.SKIP_REDIS_QUEUES === '1') {
    return null;
  }

  // Docker: always use the redis service name (host .env often has 127.0.0.1:6380).
  if (process.env.DOCKER_COMPOSE === '1') {
    console.log('[Redis] Docker Compose → redis:6379');
    return 'redis://redis:6379';
  }

  const raw = process.env.REDIS_URL?.trim();

  if (raw) {
    if (/^rediss?:\/\//i.test(raw)) {
      const hostMatch = raw.match(/@([^:/]+)/) || raw.match(/\/\/([^:/]+)/);
      const host = hostMatch ? hostMatch[1] : 'redis';
      const tls = raw.startsWith('rediss://');
      console.log(`[Redis] Using REDIS_URL → ${tls ? 'TLS ' : ''}${host}`);
      return raw;
    }
    console.error('[Redis] REDIS_URL must start with redis:// or rediss://');
  } else if (isHostedRuntime()) {
    console.error('[Redis] REDIS_URL missing — add Upstash URL on Render; remove REDIS_HOST');
  }

  if (isHostedRuntime()) {
    return null;
  }

  console.warn('[Redis] Local dev fallback →', process.env.REDIS_HOST || '127.0.0.1', process.env.REDIS_PORT || 6379);
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
  };
}

module.exports = { getRedisConnection, isHostedRuntime };
