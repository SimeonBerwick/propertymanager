import { describe, expect, test } from 'vitest'
import { redactOperatorAlertDetails, resultHasFailures } from './operator-alerts'

describe('resultHasFailures', () => {
  test('recognizes nested operational failures', () => {
    expect(resultHasFailures({ exports: { ok: false } })).toBe(true)
    expect(resultHasFailures({ sync: { failed: 2 } })).toBe(true)
    expect(resultHasFailures({ sync: { ok: true, processed: 3 } })).toBe(false)
  })
})

describe('redactOperatorAlertDetails', () => {
  test('removes credentials and private contact details from alert emails', () => {
    const redacted = redactOperatorAlertDetails({
      email: 'tenant@example.com',
      otpCode: '123456',
      databaseUrl: 'postgresql://user:password@db.example.com/app',
      error: new Error('Failed at postgresql://user:password@db.example.com/app'),
      requestId: 'request-123',
    })

    expect(redacted).toEqual({
      email: '[redacted]',
      otpCode: '[redacted]',
      databaseUrl: '[redacted]',
      error: { name: 'Error', message: 'Failed at postgresql://[redacted]@db.example.com/app' },
      requestId: 'request-123',
    })
  })
})
