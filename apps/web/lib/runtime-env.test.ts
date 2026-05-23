import { afterEach, describe, expect, test } from 'vitest'
import { assertHostedRuntimeReady, getAppBaseUrl, getRuntimeChecks } from '@/lib/runtime-env'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('runtime-env', () => {
  test('stays advisory outside hosted production enforcement', () => {
    delete process.env.HOSTED_RUNTIME_REQUIRED
    delete process.env.VERCEL_ENV
    delete process.env.APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL

    expect(() => assertHostedRuntimeReady('test', ['base'])).not.toThrow()
    expect(getAppBaseUrl('test')).toBe('http://localhost:3000')
  })

  test('fails fast under hosted production enforcement', () => {
    process.env.HOSTED_RUNTIME_REQUIRED = 'true'
    process.env.DATABASE_URL = 'file:./dev.db'
    process.env.SESSION_SECRET = 'short'
    process.env.APP_URL = 'http://localhost:3000'
    process.env.NEXT_PUBLIC_APP_URL = 'https://pm.example.com'

    expect(() => assertHostedRuntimeReady('test', ['base'])).toThrow(/Hosted runtime misconfigured/)
  })

  test('marks media and rate-limit backends as not production-ready yet', () => {
    const checks = getRuntimeChecks()
    expect(checks.find((check) => check.id === 'mediaBackend')?.ok).toBe(false)
    expect(checks.find((check) => check.id === 'rateLimitBackend')?.ok).toBe(false)
  })
})
