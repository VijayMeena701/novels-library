import { Redis } from 'ioredis';
import { config } from './index';

export const redisUrl = config.redisUrl;

export const redisClient: Redis | null = await (async (): Promise<Redis | null> => {
  if (!config.redisEnabled) {
    return null;
  }

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    retryStrategy: () => null,
    showFriendlyErrorStack: config.nodeEnv !== 'production',
  });

  client.on('error', (err) => {
    console.error('[Redis] Error:', err);
    // suppress unhandled error events; connection failures are logged in the connect try/catch
  });

  try {
    await client.connect();
    console.log(`[Redis] Connected to Redis at ${redisUrl}`);
    return client;
  } catch (err) {
    console.warn('[Redis] Could not connect to Redis at', redisUrl, '-', err instanceof Error ? err.message : err);
    try {
      client.disconnect();
    } catch {
      // ignore
    }
    return null;
  }
})();
