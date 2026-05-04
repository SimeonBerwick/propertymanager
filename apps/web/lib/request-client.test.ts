import { describe, expect, test } from 'vitest'
import { extractForwardedIp, normalizeUserAgent, resolveRequestClientContext } from '@/lib/request-client'

describe('request client helpers', () => {
  test('extracts first forwarded ip', () => {
    expect(extractForwardedIp('198.51.100.10, 10.0.0.1')).toBe('198.51.100.10')
    expect(extractForwardedIp(' 203.0.113.9 ')).toBe('203.0.113.9')
    expect(extractForwardedIp(null)).toBeUndefined()
  })

  test('normalizes user agent', () => {
    expect(normalizeUserAgent(' Mozilla/5.0 ')).toBe('mozilla/5.0')
    expect(normalizeUserAgent('')).toBeUndefined()
    expect(normalizeUserAgent('A'.repeat(200))).toHaveLength(160)
  })

  test('prefers ip and falls back to user agent', () => {
    const withIp = resolveRequestClientContext({
      get(name: string) {
        return ({
          'x-forwarded-for': '198.51.100.7, 10.0.0.2',
          'user-agent': 'Mozilla/5.0',
        } as Record<string, string | null>)[name] ?? null
      },
    })

    expect(withIp).toEqual({
      ip: '198.51.100.7',
      userAgent: 'mozilla/5.0',
      clientHint: '198.51.100.7',
    })

    const withoutIp = resolveRequestClientContext({
      get(name: string) {
        return ({ 'user-agent': 'Mozilla/5.0 (Mobile)' } as Record<string, string | null>)[name] ?? null
      },
    })

    expect(withoutIp).toEqual({
      ip: undefined,
      userAgent: 'mozilla/5.0 (mobile)',
      clientHint: 'ua:mozilla/5.0 (mobile)',
    })
  })
})
