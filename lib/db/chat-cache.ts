import "server-only";

import type { ChatMessage } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { getRedisClient } from "@/lib/redis";
import type { Chat } from "./schema";
import SuperJSON from "superjson";

const CHAT_CACHE_TTL_SECONDS = 10 * 60;
const CHAT_LIST_INDEX_TTL_SECONDS = 24 * 60 * 60;

function getCachePrefix() {
  return `${config.appPrefix}:chat-cache`;
}

function getProjectScope(projectId?: string | null) {
  if (projectId === undefined) {
    return "all";
  }

  if (projectId === null) {
    return "none";
  }

  return projectId;
}

function getChatCacheKey(chatId: string) {
  return `${getCachePrefix()}:chat:${chatId}`;
}

function getChatMessagesCacheKey(chatId: string) {
  return `${getCachePrefix()}:chat-messages:${chatId}`;
}

function getUserChatsCacheKey({
  userId,
  projectId,
}: {
  userId: string;
  projectId?: string | null;
}) {
  return `${getCachePrefix()}:user-chats:${userId}:${getProjectScope(projectId)}`;
}

function getUserChatListIndexKey(userId: string) {
  return `${getCachePrefix()}:user-chat-list-index:${userId}`;
}

async function readCachedValue<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const value = await redis.get(key);
    if (value === null) {
      return null;
    }

    return SuperJSON.parse<T>(value);
  } catch (error) {
    console.error("Failed to read chat cache", { error, key });
    return null;
  }
}

async function writeCachedValue<T>(key: string, value: T): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.set(key, SuperJSON.stringify(value), {
      expiration: {
        type: "EX",
        value: CHAT_CACHE_TTL_SECONDS,
      },
    });
  } catch (error) {
    console.error("Failed to write chat cache", { error, key });
  }
}

async function deleteCachedKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await Promise.all(keys.map((key) => redis.del(key)));
  } catch (error) {
    console.error("Failed to delete chat cache keys", { error, keys });
  }
}

async function trackUserChatListKey(userId: string, key: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const indexKey = getUserChatListIndexKey(userId);
    await redis.sAdd(indexKey, key);
    await redis.expire(indexKey, CHAT_LIST_INDEX_TTL_SECONDS);
  } catch (error) {
    console.error("Failed to track user chat list cache key", {
      error,
      key,
      userId,
    });
  }
}

export async function getCachedChatById(chatId: string): Promise<Chat | null> {
  return readCachedValue<Chat>(getChatCacheKey(chatId));
}

export async function setCachedChat(chatValue: Chat): Promise<void> {
  await writeCachedValue(getChatCacheKey(chatValue.id), chatValue);
}

export async function invalidateChatCache(chatId: string): Promise<void> {
  await deleteCachedKeys([getChatCacheKey(chatId)]);
}

export async function getCachedChatMessages(
  chatId: string
): Promise<ChatMessage[] | null> {
  return readCachedValue<ChatMessage[]>(getChatMessagesCacheKey(chatId));
}

export async function setCachedChatMessages(
  chatId: string,
  messages: ChatMessage[]
): Promise<void> {
  await writeCachedValue(getChatMessagesCacheKey(chatId), messages);
}

export async function invalidateChatMessagesCache(
  chatId: string
): Promise<void> {
  await deleteCachedKeys([getChatMessagesCacheKey(chatId)]);
}

export async function getCachedChatsByUserId(args: {
  userId: string;
  projectId?: string | null;
}): Promise<Chat[] | null> {
  return readCachedValue<Chat[]>(getUserChatsCacheKey(args));
}

export async function setCachedChatsByUserId(args: {
  chats: Chat[];
  projectId?: string | null;
  userId: string;
}): Promise<void> {
  const key = getUserChatsCacheKey(args);
  await Promise.all([
    writeCachedValue(key, args.chats),
    trackUserChatListKey(args.userId, key),
  ]);
}

export async function invalidateUserChatListCaches(
  userId: string
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  const indexKey = getUserChatListIndexKey(userId);

  try {
    const keys = await redis.sMembers(indexKey);
    await deleteCachedKeys([...keys, indexKey]);
  } catch (error) {
    console.error("Failed to invalidate user chat list caches", {
      error,
      userId,
    });
  }
}

export async function invalidateChatReadCaches(args: {
  chatId: string;
  userId?: string | null;
}): Promise<void> {
  await Promise.all([
    invalidateChatCache(args.chatId),
    invalidateChatMessagesCache(args.chatId),
    args.userId ? invalidateUserChatListCaches(args.userId) : Promise.resolve(),
  ]);
}
