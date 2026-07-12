import { redisClient } from "../config/redis.js";

const CACHE_PREFIX = "books:";
const memoryCache = new Map<string, unknown>();

async function getFromRedis<T>(key: string): Promise<T | null> {
	if (!redisClient) return null;
	const value = await redisClient.get(CACHE_PREFIX + key);
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

async function setInRedis<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	if (!redisClient) return;
	await redisClient.setex(CACHE_PREFIX + key, ttlSeconds, JSON.stringify(value));
}

async function deleteFromRedis(key: string): Promise<void> {
	if (!redisClient) return;
	await redisClient.del(CACHE_PREFIX + key);
}

export class CacheManager {
	static async get<T>(key: string): Promise<T | null> {
		if (redisClient) return getFromRedis<T>(key);
		return (memoryCache.get(key) as T) ?? null;
	}

	static async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
		if (redisClient) {
			await setInRedis(key, value, ttlSeconds);
		} else {
			memoryCache.set(key, value);
		}
	}

	static async delete(key: string): Promise<void> {
		if (redisClient) {
			await deleteFromRedis(key);
		} else {
			memoryCache.delete(key);
		}
	}

	static async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 300): Promise<T> {
		const cached = await CacheManager.get<T>(key);
		if (cached !== null) return cached;
		const value = await fetcher();
		await CacheManager.set(key, value, ttlSeconds);
		return value;
	}

	static async clear(): Promise<void> {
		if (redisClient) {
			const keys = await redisClient.keys(CACHE_PREFIX + "*");
			if (keys.length) await redisClient.del(...keys);
		} else {
			memoryCache.clear();
		}
	}
}
