import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { clearRateLimitState, getRateLimitStatus, resetRateLimit, takeRateLimitHit } from '@/lib/rate-limit'

const originalEnv = { ...process.env }
const fetchMock = vi.fn()

beforeEach(() => {
  process.env = { ...originalEnv }
  clearRateLimitState()
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
})

describe('rate-limit', () => {
  test('uses local memory backend by default', async () => {
    const policy = { limit: 2, windowMs: 60_000 }
    expect(await getRateLimitStatus('local', policy)).toEqual({ ok: true, remaining: 2 })
    expect(await takeRateLimitHit('local', policy)).toEqual({ ok: true, remaining: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('uses Upstash backend when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK' }) })

    const result = await takeRateLimitHit('shared', { limit: 2, windowMs: 60_000 })
    expect(result).toEqual({ ok: true, remaining: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/get/shared')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/set/shared')
  })

  test('persists Upstash buckets without double-serializing the value', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK' }) })

    await takeRateLimitHit('shared', { limit: 2, windowMs: 60_000 })

    const requestInit = fetchMock.mock.calls[1]?.[1] as { method?: string; body?: string }
    expect(requestInit.method).toBe('POST')
    expect(JSON.parse(requestInit.body ?? '{}')).toMatchObject({
      hits: expect.any(Array),
      blockedUntil: null,
    })
  })

  test('blocks repeated hits when Upstash returns a persisted bucket', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: JSON.stringify({ hits: [Date.now() - 1000], blockedUntil: null }) }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK' }) })

    const result = await takeRateLimitHit('shared', { limit: 2, windowMs: 60_000, blockMs: 60_000 })
    expect(result.ok).toBe(false)
  })

  test('resets Upstash bucket when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 1 }) })
    await resetRateLimit('shared')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/del/shared')
  })
})
