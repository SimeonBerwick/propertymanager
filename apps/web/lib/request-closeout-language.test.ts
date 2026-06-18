import { describe, expect, test } from 'vitest'
import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'

describe('deriveRequestCloseoutLanguage', () => {
  test('labels open work without payment language', () => {
    const result = deriveRequestCloseoutLanguage({ status: 'scheduled' })

    expect(result.phase).toBe('open')
    expect(result.paymentState).toBe('none')
    expect(result.managerLabel).toBe('Scheduled')
    expect(result.tenantLabel).toBe('Visit scheduled')
  })

  test('labels completed unpaid work consistently', () => {
    const result = deriveRequestCloseoutLanguage({ status: 'completed', outstandingCents: 5000 })

    expect(result.phase).toBe('completed')
    expect(result.paymentState).toBe('unpaid')
    expect(result.managerLabel).toBe('Completed - unpaid')
    expect(result.vendorLabel).toBe('Completed - unpaid')
  })

  test('labels closed paid work as paid and closed for manager and vendor', () => {
    const result = deriveRequestCloseoutLanguage({
      status: 'closed',
      billingDocuments: [{ status: 'paid', totalCents: 5000, paidCents: 5000 }],
    })

    expect(result.phase).toBe('closed')
    expect(result.paymentState).toBe('paid')
    expect(result.managerLabel).toBe('Paid and closed')
    expect(result.vendorLabel).toBe('Paid and closed')
  })

  test('labels closed unpaid work consistently', () => {
    const result = deriveRequestCloseoutLanguage({
      status: 'closed',
      billingDocuments: [{ status: 'sent', totalCents: 5000, paidCents: 0 }],
    })

    expect(result.phase).toBe('closed')
    expect(result.paymentState).toBe('unpaid')
    expect(result.managerLabel).toBe('Closed - unpaid')
    expect(result.vendorLabel).toBe('Closed - unpaid')
  })
})
