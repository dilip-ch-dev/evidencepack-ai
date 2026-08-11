import { prisma } from "@/lib/prisma";
import { getSessionIdHash } from "@/lib/session";

export class RateLimitExceededError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many requests. Please wait before trying again.");
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function enforceRateLimit(action: string, limit: number, windowMs: number) {
  const sessionIdHash = getSessionIdHash();
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStartedAt = new Date(windowStartMs);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      sessionIdHash_action_windowStartedAt: { sessionIdHash, action, windowStartedAt }
    },
    update: { count: { increment: 1 } },
    create: { sessionIdHash, action, windowStartedAt, count: 1 }
  });

  if (bucket.count > limit) {
    throw new RateLimitExceededError(Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000)));
  }
}
