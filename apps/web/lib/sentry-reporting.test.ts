import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureSentryException } from '@/lib/sentry-reporting'

afterEach(() => {
  delete process.env.SENTRY_DSN
  vi.unstubAllGlobals()
})

describe('Sentry reporting', () => {
  it('does nothing when Sentry is not configured', async () => {
    await expect(captureSentryException(new Error('test'))).resolves.toMatchObject({ skipped: true })
  })

  it('sends a scrubbed envelope to the configured project', async () => {
    process.env.SENTRY_DSN = 'https://public-key@errors.example.com/42'
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await captureSentryException(new Error('failed with Bearer secret-token'), {
      area: 'test.area',
      extra: { password: 'private', safe: 'visible' },
    })

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('errors.example.com/api/42/envelope/')
    expect(String(init.body)).toContain('Bearer [redacted]')
    expect(String(init.body)).not.toContain('private')
  })
})
