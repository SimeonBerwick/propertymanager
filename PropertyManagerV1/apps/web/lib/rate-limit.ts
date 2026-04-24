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

export function getRateLimitStatus(key: string, policy: RateLimitPolicy): RateLimitResult {
  const bucket = getBucket(key)
  const now = normalizeBucket(bucket, policy)

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
    }
  }

  return { ok: true, remaining: Math.max(0, policy.limit - bucket.hits.length) }
}

export function takeRateLimitHit(key: string, policy: RateLimitPolicy): RateLimitResult {
  const bucket = getBucket(key)
  const now = normalizeBucket(bucket, policy)

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000)),
    }
  }

  bucket.hits.push(now)

  if (bucket.hits.length >= policy.limit) {
    const blockMs = policy.blockMs ?? policy.windowMs
    bucket.blockedUntil = now + blockMs
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil(blockMs / 1000)),
    }
  }

  return { ok: true, remaining: Math.max(0, policy.limit - bucket.hits.length) }
}

export function resetRateLimit(key: string) {
  buckets.delete(key)
}

export function clearRateLimitState() {
  buckets.clear()
}
