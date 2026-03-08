import "server-only";

import { createClient, type RedisClientType } from "redis";
import { env } from "@/lib/env";

let redisClientPromise: Promise<RedisClientType | null> | null = null;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({ url: env.REDIS_URL });
      client.on("error", (error) => {
        console.error("Redis client error", error);
      });
      await client.connect();
      return client;
    })().catch((error) => {
      redisClientPromise = null;
      console.error("Failed to connect Redis client", error);
      return null;
    });
  }

  return redisClientPromise;
}
