import { beforeEach, describe, expect, test, vi } from 'vitest'
import type Stripe from 'stripe'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findMany: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/stripe', () => ({ getStripeClient: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { getStripeClient } from '@/lib/stripe'
import { writeAuditLog } from '@/lib/audit-log'
import { isMissingStripeCustomerError, reconcileStripeSubscriptions, selectAuthoritativeSubscription, statusAfterMissingStripeCustomer } from '@/lib/subscription-reconciliation'

function subscription(id: string, status: Stripe.Subscription.Status, created: number) {
  return { id, status, created } as Stripe.Subscription
}

describe('selectAuthoritativeSubscription', () => {
  test('selects the newest live subscription and reports simultaneous subscriptions', () => {
    const result = selectAuthoritativeSubscription([
      subscription('sub_old', 'active', 10),
      subscription('sub_new', 'trialing', 20),
      subscription('sub_canceled', 'canceled', 30),
    ])

    expect(result.authoritative?.id).toBe('sub_new')
    expect(result.simultaneous.map((item) => item.id)).toEqual(['sub_new', 'sub_old'])
  })

  test('falls back to the newest historical subscription when none are live', () => {
    const result = selectAuthoritativeSubscription([
      subscription('sub_old', 'canceled', 10),
      subscription('sub_latest', 'incomplete_expired', 20),
    ])

    expect(result.authoritative?.id).toBe('sub_latest')
    expect(result.simultaneous).toEqual([])
  })
})

describe('missing Stripe customer recovery', () => {
  beforeEach(() => vi.clearAllMocks())

  test('recognizes a missing customer without treating every missing Stripe resource as a customer failure', () => {
    const missingCustomer = Object.assign(new Error("No such customer: 'cus_test'"), {
      code: 'resource_missing',
      raw: { code: 'resource_missing', param: 'customer' },
    })
    const missingPrice = Object.assign(new Error("No such price: 'price_test'"), {
      code: 'resource_missing',
      raw: { code: 'resource_missing', param: 'price' },
    })

    expect(isMissingStripeCustomerError(missingCustomer)).toBe(true)
    expect(isMissingStripeCustomerError(missingPrice)).toBe(false)
    expect(isMissingStripeCustomerError(new Error('Stripe is temporarily unavailable'))).toBe(false)
  })

  test('reconciles a scheduled cancellation while preserving paid access through the period end', async () => {
    const periodEnd = 1_786_909_200
    vi.mocked(prisma.user.findMany).mockResolvedValue([{
      id: 'user_canceling',
      stripeCustomerId: 'cus_canceling',
      stripeSubscriptionId: 'sub_canceling',
      subscriptionStatus: 'active',
      subscriptionPlan: 'starter',
      billingCadence: 'monthly',
      trialEndsAt: new Date('2026-08-01T00:00:00.000Z'),
      subscriptionEndsAt: null,
    }] as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(getStripeClient).mockReturnValue({
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [{
            id: 'sub_canceling',
            status: 'active',
            created: 1_784_229_600,
            cancel_at_period_end: true,
            metadata: { plan: 'starter', cadence: 'monthly' },
            items: { data: [{ current_period_end: periodEnd }] },
          }],
        }),
      },
    } as never)

    const result = await reconcileStripeSubscriptions()

    expect(result).toMatchObject({ checked: 1, repaired: 1, errors: [] })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_canceling' },
      data: expect.objectContaining({
        subscriptionStatus: 'canceled',
        subscriptionEndsAt: new Date('2026-08-16T19:40:00.000Z'),
        trialEndsAt: null,
      }),
    })
  })

  test('preserves a valid trial and expires an account with no valid trial', () => {
    const now = new Date('2026-07-16T12:00:00.000Z')

    expect(statusAfterMissingStripeCustomer(new Date('2026-08-10T00:00:00.000Z'), now)).toBe('trialing')
    expect(statusAfterMissingStripeCustomer(new Date('2026-07-01T00:00:00.000Z'), now)).toBe('expired')
    expect(statusAfterMissingStripeCustomer(null, now)).toBe('expired')
  })

  test('clears stale references, preserves a valid trial, and records the repair', async () => {
    const missingCustomer = Object.assign(new Error("No such customer: 'cus_test'"), {
      code: 'resource_missing',
      raw: { code: 'resource_missing', param: 'customer' },
    })
    vi.mocked(prisma.user.findMany).mockResolvedValue([{
      id: 'user_1',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      subscriptionStatus: 'active',
      subscriptionPlan: 'growth',
      billingCadence: 'monthly',
      trialEndsAt: new Date(Date.now() + 86_400_000),
      subscriptionEndsAt: null,
    }] as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    vi.mocked(getStripeClient).mockReturnValue({
      subscriptions: { list: vi.fn().mockRejectedValue(missingCustomer) },
    } as never)

    const result = await reconcileStripeSubscriptions()

    expect(result).toMatchObject({ checked: 1, repaired: 1, errors: [] })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: {
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: 'trialing',
        subscriptionEndsAt: null,
      },
    })
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'user_1',
      action: 'subscription.staleStripeReferenceCleared',
      metadata: expect.objectContaining({ previousCustomerId: 'cus_test', previousSubscriptionId: 'sub_test', status: 'trialing' }),
    }))
  })
})
