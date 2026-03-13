import { after } from "next/server";
import { createClient } from "redis";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { config } from "@/lib/config";
import { env } from "@/lib/env";

let redisPublisher: ReturnType<typeof createClient> | null = null;
let redisSubscriber: ReturnType<typeof createClient> | null = null;

if (env.REDIS_URL) {
  redisPublisher = createClient({ url: env.REDIS_URL });
  redisSubscriber = createClient({ url: env.REDIS_URL });
  await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext(): ResumableStreamContext | null {
  if (globalStreamContext) {
    return globalStreamContext;
  }

  if (!(redisPublisher && redisSubscriber)) {
    return null;
  }

  globalStreamContext = createResumableStreamContext({
    waitUntil: after,
    keyPrefix: `${config.appPrefix}:resumable-stream`,
    publisher: redisPublisher,
    subscriber: redisSubscriber,
  });

  return globalStreamContext;
}

export function getStreamPublisher() {
  return redisPublisher;
}
