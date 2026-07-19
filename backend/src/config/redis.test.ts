import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('redis.ts', () => {
  const originalRedisEnabled = process.env.REDIS_ENABLED;

  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_ENABLED = 'false';
  });

  afterEach(() => {
    vi.doUnmock('ioredis');
    process.env.REDIS_ENABLED = originalRedisEnabled;
  });

  it('returns null when Redis is disabled', async () => {
    const { redisClient } = await import('./redis.js');
    expect(redisClient).toBeNull();
  });

  it('returns a Redis client on successful connection', async () => {
    process.env.REDIS_ENABLED = 'true';
    const mockClient = {
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
    };
    vi.doMock('ioredis', () => ({
      Redis: vi.fn().mockImplementation(() => mockClient),
    }));

    const { redisClient } = await import('./redis.js');
    expect(redisClient).toBe(mockClient);
  });

  it('returns null and disconnects when connection fails', async () => {
    process.env.REDIS_ENABLED = 'true';
    const mockClient = {
      on: vi.fn(),
      connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
      disconnect: vi.fn(),
    };
    vi.doMock('ioredis', () => ({
      Redis: vi.fn().mockImplementation(() => mockClient),
    }));

    const { redisClient } = await import('./redis.js');
    expect(redisClient).toBeNull();
    expect(mockClient.disconnect).toHaveBeenCalled();
  });
});
