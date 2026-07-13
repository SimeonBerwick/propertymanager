import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    unit: { count: vi.fn() },
  },
}))
vi.mock('@/lib/stripe', () => ({ getStripeClient: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { getStripeClient } from '@/lib/stripe'
import { syncSubscriptionUnitPricing } from '@/lib/subscription-unit-pricing'

const subscription = {
  id: 'sub_1',
  metadata: { userId: 'user_1', plan: 'starter', purchasedCapacity: '25' },
  items: { data: [{ id: 'si_1', price: { product: 'prod_1', unit_amount: 3900, recurring: { interval: 'month' } } }] },
}

describe('subscription unit capacity synchronization', () => {
  const stripeUpdate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ subscriptionPlan: 'starter', billingCadence: 'monthly', subscriptionStatus: 'active', stripeSubscriptionId: 'sub_1', additionalUnitAllowance: 0 } as never)
    vi.mocked(prisma.unit.count).mockResolvedValue(20)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(getStripeClient).mockReturnValue({ subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription), update: stripeUpdate } } as never)
    stripeUpdate.mockResolvedValue(subscription)
  })

  it('charges once, upgrades the tier, and stores the resulting purchased capacity', async () => {
    const result = await syncSubscriptionUnitPricing('user_1', 74, true)

    expect(result).toMatchObject({ plan: 'growth', purchasedCapacity: 75, amountCents: 9900, stripeUpdated: true })
    expect(stripeUpdate).toHaveBeenCalledWith('sub_1', expect.objectContaining({
      payment_behavior: 'error_if_incomplete',
      proration_behavior: 'always_invoice',
      items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 9900 }) })],
      metadata: expect.objectContaining({ plan: 'growth', purchasedCapacity: '75', additionalUnitAllowance: '0' }),
    }))
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { subscriptionPlan: 'growth', additionalUnitAllowance: 0 } })
  })

  it('does not unlock capacity when Stripe cannot collect the prorated payment', async () => {
    stripeUpdate.mockRejectedValueOnce(new Error('Payment failed'))

    await expect(syncSubscriptionUnitPricing('user_1', 40, true)).rejects.toThrow('Payment failed')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
