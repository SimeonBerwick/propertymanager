import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { captureSentryException } from '@/lib/sentry-reporting'
import { takeRateLimitHit } from '@/lib/rate-limit'
import { POST } from './route'

vi.mock('@/lib/sentry-reporting', () => ({ captureSentryException: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ takeRateLimitHit: vi.fn() }))

const mockedCapture = vi.mocked(captureSentryException)
const mockedRateLimit = vi.mocked(takeRateLimitHit)

describe('client error monitoring endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRateLimit.mockResolvedValue({ ok: true, remaining: 5 })
  })

  test('reports successful Sentry delivery honestly', async () => {
    mockedCapture.mockResolvedValue({ ok: true, skipped: false, eventId: 'a'.repeat(32) })
    const response = await POST(new NextRequest('https://www.simeonware.com/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Production smoke test', path: '/dashboard' }),
    }))

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ accepted: true, eventId: 'a'.repeat(32) })
  })

  test('returns a failure when Sentry does not accept the event', async () => {
    mockedCapture.mockResolvedValue({ ok: false, skipped: false, eventId: 'b'.repeat(32) })
    const response = await POST(new NextRequest('https://www.simeonware.com/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Production smoke test', path: '/dashboard' }),
    }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ accepted: false, eventId: 'b'.repeat(32) })
  })
})
