import { assertHostedRuntimeReady, hasUpstashRateLimitConfig } from '@/lib/runtime-env'

type RateLimitPolicy = {
  limit: number
  windowMs: number
  blockMs?: number
}

type Bucket = {
  hits: number[]
  blockedUntil: number | null
}

const buckets = new Map<string, Bucket>()

function nowMs() {
  return Date.now()
}

function getBucket(key: string) {
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { hits: [], blockedUntil: null }
    buckets.set(key, bucket)
  }
  return bucket
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number }

function normalizeBucket(bucket: Bucket, policy: RateLimitPolicy) {
  const now = nowMs()
  const windowStart = now - policy.windowMs
  bucket.hits = bucket.hits.filter((hit) => hit > windowStart)
  if (bucket.blockedUntil && bucket.blockedUntil <= now) {
    bucket.blockedUntil = null
  }
  return now
}

function parseStoredBucket(value: string | null): Bucket {
  if (!value) return { hits: [], blockedUntil: null }

  try {
    const parsed = JSON.parse(value) as Partial<Bucket>
    return {
      hits: Array.isArray(parsed.hits) ? parsed.hits.filter((hit): hit is number => typeof hit === 'number') : [],
      blockedUntil: typeof parsed.blockedUntil === 'number' ? parsed.blockedUntil : null,
    }
  } catch {
    return { hits: [], blockedUntil: null }
  }
}

async function upstashRequest(command: string, key: string, body?: string) {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!baseUrl || !token) {
    throw new Error('Upstash rate-limit backend is not configured.')
  }

  const response = await fetch(`${baseUrl}/${command}/${encodeURIComponent(key)}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Upstash ${command} failed with ${response.status}`)
  }

  const payload = await response.json() as { result?: string | null }
  return payload.result ?? null
}

async function getUpstashBucket(key: string) {
  const stored = await upstashRequest('get', key)
  return parseStoredBucket(stored)
}

async function setUpstashBucket(key: string, bucket: Bucket) {
  await upstashRequest('set', key, JSON.stringify(JSON.stringify(bucket)))
}

async function deleteUpstashBucket(key: string) {
  await upstashRequest('del', key)
}

function rateLimitRemaining(policy: RateLimitPolicy, bucket: Bucket) {
  return Math.max(0, policy.limit - bucket.hits.length)
}

function blockedResult(blockedUntil: number, now: number): RateLimitResult {
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
  }
}

function statusFromBucket(bucket: Bucket, policy: RateLimitPolicy): RateLimitResult {
  const now = normalizeBucket(bucket, policy)

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return blockedResult(bucket.blockedUntil, now)
  }

  return { ok: true, remaining: rateLimitRemaining(policy, bucket) }
}

async function getRateLimitStatusLocal(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const bucket = getBucket(key)
  return statusFromBucket(bucket, policy)
}

async function getRateLimitStatusUpstash(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const bucket = await getUpstashBucket(key)
  return statusFromBucket(bucket, policy)
}

async function takeRateLimitHitLocal(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const bucket = getBucket(key)
  const now = normalizeBucket(bucket, policy)

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return blockedResult(bucket.blockedUntil, now)
  }

  bucket.hits.push(now)

  if (bucket.hits.length >= policy.limit) {
    const blockMs = policy.blockMs ?? policy.windowMs
    bucket.blockedUntil = now + blockMs
    return blockedResult(bucket.blockedUntil, now)
  }

  return { ok: true, remaining: rateLimitRemaining(policy, bucket) }
}

async function takeRateLimitHitUpstash(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const bucket = await getUpstashBucket(key)
  const now = normalizeBucket(bucket, policy)

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return blockedResult(bucket.blockedUntil, now)
  }

  bucket.hits.push(now)

  if (bucket.hits.length >= policy.limit) {
    const blockMs = policy.blockMs ?? policy.windowMs
    bucket.blockedUntil = now + blockMs
    await setUpstashBucket(key, bucket)
    return blockedResult(bucket.blockedUntil, now)
  }

  await setUpstashBucket(key, bucket)
  return { ok: true, remaining: rateLimitRemaining(policy, bucket) }
}

export async function getRateLimitStatus(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  assertHostedRuntimeReady('rate limiting', ['rateLimit'])
  return hasUpstashRateLimitConfig()
    ? getRateLimitStatusUpstash(key, policy)
    : getRateLimitStatusLocal(key, policy)
}

export async function takeRateLimitHit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  assertHostedRuntimeReady('rate limiting', ['rateLimit'])
  return hasUpstashRateLimitConfig()
    ? takeRateLimitHitUpstash(key, policy)
    : takeRateLimitHitLocal(key, policy)
}

export async function resetRateLimit(key: string) {
  if (hasUpstashRateLimitConfig()) {
    await deleteUpstashBucket(key)
    return
  }
  buckets.delete(key)
}

export function clearRateLimitState() {
  buckets.clear()
}
