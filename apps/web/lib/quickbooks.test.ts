import { beforeEach, describe, expect, it } from 'vitest'
import { createQuickBooksState, quickBooksApprovedLimit, quickBooksContentHash, quickBooksTransactionUrl, verifyQuickBooksState } from '@/lib/quickbooks'

describe('QuickBooks integration helpers', () => {
  beforeEach(() => { process.env.SESSION_SECRET = 'quickbooks-test-session-secret-at-least-32-characters' })

  it('accepts an intact, recent OAuth state only', () => {
    const now = Date.parse('2026-07-15T12:00:00Z')
    const state = createQuickBooksState('manager-1', now)
    expect(verifyQuickBooksState(state, now + 60_000)).toEqual({ userId: 'manager-1' })
    expect(verifyQuickBooksState(`${state}x`, now + 60_000)).toBeNull()
    expect(verifyQuickBooksState(state, now + 11 * 60_000)).toBeNull()
  })

  it('creates stable source hashes and environment-specific transaction links', () => {
    expect(quickBooksContentHash({ amount: 5000 })).toBe(quickBooksContentHash({ amount: 5000 }))
    expect(quickBooksContentHash({ amount: 5000 })).not.toBe(quickBooksContentHash({ amount: 5001 }))
    expect(quickBooksTransactionUrl('sandbox', 'Bill', '12')).toContain('sandbox.qbo.intuit.com/app/bill?txnId=12')
    expect(quickBooksTransactionUrl('production', 'Invoice', '14')).toContain('qbo.intuit.com/app/invoice?txnId=14')
  })

  it('only exposes amounts covered by manager financial approval', () => {
    expect(quickBooksApprovedLimit({ recipientType: 'tenant', tenantBillbackDecision: 'bill_tenant', tenantBillbackAmountCents: 5000 })).toBe(5000)
    expect(quickBooksApprovedLimit({ recipientType: 'tenant', tenantBillbackDecision: 'none', tenantBillbackAmountCents: 5000 })).toBe(0)
    expect(quickBooksApprovedLimit({ recipientType: 'vendor', vendorCommercialItems: [
      { itemType: 'service_fee', status: 'approved', amountCents: 45000 },
      { itemType: 'bill_to_property_manager', status: 'approved', amountCents: 50000 },
    ] })).toBe(50000)
    expect(quickBooksApprovedLimit({ recipientType: 'vendor', vendorCommercialItems: [{ itemType: 'service_fee', status: 'submitted', amountCents: 45000 }] })).toBe(0)
  })
})
