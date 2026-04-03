import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

function hashPart(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export function buildRateLimitBucket(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => hashPart(part.trim().toLowerCase()))
    .join(':');
}

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export async function enforceRateLimit(input: {
  scope: string;
  bucket: string;
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
}) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - input.windowMs);

  const existing = await prisma.authRateLimit.findUnique({
    where: {
      scope_bucket: {
        scope: input.scope,
        bucket: input.bucket,
      },
    },
  });

  if (!existing) {
    return { ok: true } satisfies RateLimitDecision;
  }

  if (existing.blockedUntil && existing.blockedUntil > now) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil.getTime() - now.getTime()) / 1000)),
    } satisfies RateLimitDecision;
  }

  if (existing.windowStart < windowStart) {
    await prisma.authRateLimit.update({
      where: { scope_bucket: { scope: input.scope, bucket: input.bucket } },
      data: { count: 0, windowStart: now, blockedUntil: null },
    });
    return { ok: true } satisfies RateLimitDecision;
  }

  if (existing.count >= input.maxAttempts) {
    const blockedUntil = existing.blockedUntil && existing.blockedUntil > now
      ? existing.blockedUntil
      : new Date(now.getTime() + input.blockMs);

    if (!existing.blockedUntil || existing.blockedUntil <= now) {
      await prisma.authRateLimit.update({
        where: { scope_bucket: { scope: input.scope, bucket: input.bucket } },
        data: { blockedUntil },
      });
    }

    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)),
    } satisfies RateLimitDecision;
  }

  return { ok: true } satisfies RateLimitDecision;
}

export async function recordRateLimitFailure(input: {
  scope: string;
  bucket: string;
  windowMs: number;
  maxAttempts: number;
  blockMs: number;
}) {
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - input.windowMs);

  const existing = await prisma.authRateLimit.findUnique({
    where: {
      scope_bucket: {
        scope: input.scope,
        bucket: input.bucket,
      },
    },
  });

  if (!existing) {
    const count = 1;
    const blockedUntil = count >= input.maxAttempts ? new Date(now.getTime() + input.blockMs) : null;
    await prisma.authRateLimit.create({
      data: {
        scope: input.scope,
        bucket: input.bucket,
        windowStart: now,
        count,
        blockedUntil,
      },
    });
    return;
  }

  const resetWindow = existing.windowStart < windowStartCutoff;
  const count = resetWindow ? 1 : existing.count + 1;
  const blockedUntil = count >= input.maxAttempts ? new Date(now.getTime() + input.blockMs) : null;

  await prisma.authRateLimit.update({
    where: {
      scope_bucket: {
        scope: input.scope,
        bucket: input.bucket,
      },
    },
    data: {
      count,
      windowStart: resetWindow ? now : existing.windowStart,
      blockedUntil,
    },
  });
}

export async function clearRateLimitFailures(scope: string, bucket: string) {
  await prisma.authRateLimit.deleteMany({ where: { scope, bucket } });
}
