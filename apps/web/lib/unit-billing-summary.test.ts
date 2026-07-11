import { describe, expect, it } from 'vitest'
import { summarizeUnitBilling } from '@/lib/unit-billing-summary'

describe('summarizeUnitBilling', () => {
  it('separates calendar years, excludes pre-tenancy charges, and preserves currencies', () => {
    const rows = summarizeUnitBilling([{
      id: 'unit-1',
      label: 'A',
      property: { name: 'Test Duplex' },
      tenantIdentities: [{ tenantName: 'Current Tenant', leaseStartDate: new Date('2025-06-01T00:00:00Z'), createdAt: new Date('2025-05-01T00:00:00Z') }],
      requests: [
        {
          status: 'completed', preferredCurrency: 'usd', actualCompletedAt: new Date('2026-02-01T00:00:00Z'), closedAt: null,
          tenantBillbackDecision: 'bill_tenant', tenantBillbackAmountCents: 1000, tenantBillbackDecidedAt: new Date('2026-02-02T00:00:00Z'), dispatchHistory: [],
          vendorCommercialItems: [
            { itemType: 'bid', status: 'approved', currency: 'usd', amountCents: 2000, submittedAt: new Date('2026-01-01T00:00:00Z') },
            { itemType: 'bill_to_property_manager', status: 'approved', currency: 'usd', amountCents: 2500, submittedAt: new Date('2026-02-01T00:00:00Z') },
          ],
        },
        {
          status: 'closed', preferredCurrency: 'eur', actualCompletedAt: new Date('2025-08-01T00:00:00Z'), closedAt: new Date('2025-08-03T00:00:00Z'),
          tenantBillbackDecision: 'bill_tenant', tenantBillbackAmountCents: 900, tenantBillbackDecidedAt: new Date('2025-08-02T00:00:00Z'), dispatchHistory: [],
          vendorCommercialItems: [{ itemType: 'service_fee', status: 'approved', currency: 'eur', amountCents: 4000, submittedAt: new Date('2025-08-01T00:00:00Z') }],
        },
      ],
    }], new Date('2026-07-10T12:00:00Z'))

    expect(rows[0].currentYear).toEqual({ workCosts: { usd: 2500 }, tenantBillbacks: { usd: 1000 } })
    expect(rows[0].previousYear).toEqual({ workCosts: { eur: 4000 }, tenantBillbacks: { eur: 900 } })
    expect(rows[0].currentTenancy).toEqual({ workCosts: { usd: 2500, eur: 4000 }, tenantBillbacks: { usd: 1000, eur: 900 } })
  })
})
