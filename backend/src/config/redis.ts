import { Redis } from 'ioredis';

export const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisClient: Redis | null = null;

if (process.env.REDIS_ENABLED !== 'false') {
  redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    retryStrategy: () => null,
    showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  });

  redisClient.on('error', (err) => {
    // suppress unhandled error events; connection failures are logged in the connect try/catch
  });

  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('[Redis] Could not connect to Redis at', redisUrl, '-', err instanceof Error ? err.message : err);
    try {
      redisClient.disconnect();
    } catch {
      // ignore
    }
    redisClient = null;
  }
}

export { redisClient };
