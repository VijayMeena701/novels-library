import { Redis } from 'ioredis';
import { config } from './index';

export const redisUrl = config.redisUrl;

let redisClient: Redis | null = null;

if (config.redisEnabled) {
  redisClient = new Redis(redisUrl, {
    lazyConnect: true,
    retryStrategy: () => null,
    showFriendlyErrorStack: config.nodeEnv !== 'production',
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
