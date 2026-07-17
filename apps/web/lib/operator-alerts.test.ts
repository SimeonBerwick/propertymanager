import { describe, expect, test } from 'vitest'
import { redactOperatorAlertDetails, resultHasFailures } from './operator-alerts'

describe('resultHasFailures', () => {
  test('recognizes nested operational failures', () => {
    expect(resultHasFailures({ exports: { ok: false } })).toBe(true)
    expect(resultHasFailures({ sync: { failed: 2 } })).toBe(true)
    expect(resultHasFailures({ reconciliation: { errors: [{ message: 'Stripe unavailable' }] } })).toBe(true)
    expect(resultHasFailures({ sync: { ok: true, processed: 3 } })).toBe(false)
  })

  test('does not alert for zero failures or successful repairs', () => {
    expect(resultHasFailures({
      subscriptionReconciliation: {
        checked: 3,
        repaired: 1,
        duplicateCustomers: [],
        errors: [],
      },
      subscriptionUnitPricing: {
        processed: 5,
        updated: 0,
        failed: 0,
      },
      vendorReminders: {
        ok: true,
        deliveryFailureCount: 0,
      },
    })).toBe(false)
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
