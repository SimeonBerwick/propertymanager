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

  test('reports whether multilingual translation is configured', () => {
    delete process.env.GOOGLE_TRANSLATE_API_KEY
    expect(getRuntimeChecks().find((check) => check.id === 'googleTranslateApiKey')?.ok).toBe(false)
    process.env.GOOGLE_TRANSLATE_API_KEY = 'valid-google-translation-api-key-12345'
    expect(getRuntimeChecks().find((check) => check.id === 'googleTranslateApiKey')?.ok).toBe(true)
  })

  test('flags placeholder SMTP_URL values as blocking under hosted enforcement', () => {
    process.env.HOSTED_RUNTIME_REQUIRED = 'true'
    process.env.DATABASE_URL = 'postgresql://user:pass@db.example.net/app?sslmode=require'
    process.env.SESSION_SECRET = '12345678901234567890123456789012'
    process.env.APP_URL = 'https://propertymanager-alpha.vercel.app'
    process.env.NEXT_PUBLIC_APP_URL = 'https://propertymanager-alpha.vercel.app'
    process.env.INTERNAL_AUTOMATION_SECRET = 'abcdefghijklmnopqrstuvwxyz123456'
    process.env.NOTIFY_TRANSPORT = 'smtp'
    process.env.SMTP_URL = 'smtps://user:pass@smtp.example.com:465'

    const smtpCheck = getRuntimeChecks().find((check) => check.id === 'smtpUrl')
    expect(smtpCheck?.ok).toBe(false)
    expect(smtpCheck?.detail).toMatch(/placeholder/i)
  })

  test('requires an operator alert recipient in hosted notification checks', () => {
    process.env.HOSTED_RUNTIME_REQUIRED = 'true'
    delete process.env.OPS_ALERT_EMAIL
    expect(() => assertHostedRuntimeReady('test', ['notifications'])).toThrow(/OPS_ALERT_EMAIL/)

    process.env.OPS_ALERT_EMAIL = 'support@simeonware.com'
    process.env.NOTIFY_TRANSPORT = 'smtp'
    process.env.SMTP_URL = 'smtps://resend:real-secret@smtp.resend.com:465'
    expect(() => assertHostedRuntimeReady('test', ['notifications'])).not.toThrow()
  })
})
