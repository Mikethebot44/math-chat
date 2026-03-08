import "server-only";

import { getRedisClient } from "@/lib/redis";

const PENDING_MESSAGE_CANCELLATION_TTL_SECONDS = 5 * 60;
const pendingMessageCancellationFallback = new Map<string, number>();

function getPendingMessageCancellationKey({
  chatId,
  messageId,
  userId,
}: {
  chatId: string;
  messageId: string;
  userId: string;
}) {
  return `pending-message-cancellation:${userId}:${chatId}:${messageId}`;
}

export async function rememberPendingMessageCancellation({
  chatId,
  messageId,
  userId,
}: {
  chatId: string;
  messageId: string;
  userId: string;
}) {
  const key = getPendingMessageCancellationKey({
    chatId,
    messageId,
    userId,
  });
  const redis = await getRedisClient();

  if (redis) {
    await redis.set(key, "1", {
      expiration: {
        type: "EX",
        value: PENDING_MESSAGE_CANCELLATION_TTL_SECONDS,
      },
    });
    return;
  }

  pendingMessageCancellationFallback.set(
    key,
    Date.now() + PENDING_MESSAGE_CANCELLATION_TTL_SECONDS * 1000
  );
}

export async function consumePendingMessageCancellation({
  chatId,
  messageId,
  userId,
}: {
  chatId: string;
  messageId: string;
  userId: string;
}) {
  const key = getPendingMessageCancellationKey({
    chatId,
    messageId,
    userId,
  });
  const redis = await getRedisClient();

  if (redis) {
    const value = await redis.get(key);
    if (value === null) {
      return false;
    }

    await redis.del(key);
    return true;
  }

  const expiresAt = pendingMessageCancellationFallback.get(key);
  if (!expiresAt) {
    return false;
  }

  pendingMessageCancellationFallback.delete(key);
  return expiresAt > Date.now();
}
