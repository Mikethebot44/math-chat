import "server-only";

import { createClient } from "redis";
import { env } from "@/lib/env";

type RedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<RedisClient | null> | null = null;

export async function getRedisClient(): Promise<RedisClient | null> {
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
