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
const REDIS_PREFIX = 'pm:ratelimit:'

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

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

let redisPromise: Promise<import('@upstash/redis').Redis> | null = null
let loggedRedisFailure = false

async function getRedis() {
  const config = getRedisConfig()
  if (!config) return null

  if (!redisPromise) {
    redisPromise = import('@upstash/redis').then(({ Redis }) => new Redis(config))
  }

  return redisPromise
}

function getHitsKey(key: string) {
  return `${REDIS_PREFIX}${key}:hits`
}

function getBlockedKey(key: string) {
  return `${REDIS_PREFIX}${key}:blocked`
}

function logRedisFailure(error: unknown) {
  if (loggedRedisFailure) return
  loggedRedisFailure = true
  console.error('[rate-limit] Upstash unavailable, falling back to in-memory limiter.', error)
}

function getLocalRateLimitStatus(key: string, policy: RateLimitPolicy): RateLimitResult {
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

function takeLocalRateLimitHit(key: string, policy: RateLimitPolicy): RateLimitResult {
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

async function getRedisRateLimitStatus(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const redis = await getRedis()
  if (!redis) return getLocalRateLimitStatus(key, policy)

  const blockedKey = getBlockedKey(key)
  const hitsKey = getHitsKey(key)
  const now = nowMs()
  const windowStart = now - policy.windowMs

  try {
    const blockedUntil = await redis.get<number>(blockedKey)
    if (typeof blockedUntil === 'number' && blockedUntil > now) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      }
    }

    await redis.zremrangebyscore(hitsKey, 0, windowStart)
    const hitCount = await redis.zcard(hitsKey)
    await redis.pexpire(hitsKey, policy.windowMs)
    return { ok: true, remaining: Math.max(0, policy.limit - Number(hitCount)) }
  } catch (error) {
    logRedisFailure(error)
    return getLocalRateLimitStatus(key, policy)
  }
}

async function takeRedisRateLimitHit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const redis = await getRedis()
  if (!redis) return takeLocalRateLimitHit(key, policy)

  const blockedKey = getBlockedKey(key)
  const hitsKey = getHitsKey(key)
  const now = nowMs()
  const windowStart = now - policy.windowMs
  const blockMs = policy.blockMs ?? policy.windowMs

  try {
    const blockedUntil = await redis.get<number>(blockedKey)
    if (typeof blockedUntil === 'number' && blockedUntil > now) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      }
    }

    await redis.zremrangebyscore(hitsKey, 0, windowStart)
    await redis.zadd(hitsKey, { score: now, member: `${now}-${Math.random().toString(36).slice(2)}` })
    const hitCount = await redis.zcard(hitsKey)
    await redis.pexpire(hitsKey, policy.windowMs)

    if (Number(hitCount) >= policy.limit) {
      const blockedUntilMs = now + blockMs
      await redis.set(blockedKey, blockedUntilMs, { px: blockMs })
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil(blockMs / 1000)),
      }
    }

    return { ok: true, remaining: Math.max(0, policy.limit - Number(hitCount)) }
  } catch (error) {
    logRedisFailure(error)
    return takeLocalRateLimitHit(key, policy)
  }
}

export async function getRateLimitStatus(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  return getRedisRateLimitStatus(key, policy)
}

export async function takeRateLimitHit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  return takeRedisRateLimitHit(key, policy)
}

export async function resetRateLimit(key: string) {
  buckets.delete(key)

  const redis = await getRedis()
  if (!redis) return

  try {
    await redis.del(getHitsKey(key), getBlockedKey(key))
  } catch (error) {
    logRedisFailure(error)
  }
}

export function clearRateLimitState() {
  buckets.clear()
}
