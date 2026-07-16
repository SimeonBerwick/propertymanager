import { describe, expect, test } from 'vitest'
import type Stripe from 'stripe'
import { stripeSubscriptionAccountStatus, stripeSubscriptionPeriodEnd } from '@/lib/stripe-subscription-period'

function subscriptionWithPeriods(itemPeriods: number[], legacyPeriod?: number) {
  return {
    items: {
      data: itemPeriods.map((current_period_end) => ({ current_period_end })),
    },
    ...(legacyPeriod ? { current_period_end: legacyPeriod } : {}),
  } as unknown as Stripe.Subscription
}

function subscriptionStatus(status: Stripe.Subscription.Status, cancelAtPeriodEnd = false) {
  return { status, cancel_at_period_end: cancelAtPeriodEnd } as Stripe.Subscription
}

describe('stripeSubscriptionPeriodEnd', () => {
  test('reads the current Stripe API item period', () => {
    expect(stripeSubscriptionPeriodEnd(subscriptionWithPeriods([1_786_909_200])))
      .toEqual(new Date('2026-08-16T19:40:00.000Z'))
  })

  test('uses the next period when a subscription has multiple items', () => {
    expect(stripeSubscriptionPeriodEnd(subscriptionWithPeriods([1_790_101_200, 1_786_909_200])))
      .toEqual(new Date('2026-08-16T19:40:00.000Z'))
  })

  test('remains compatible with the legacy top-level field', () => {
    expect(stripeSubscriptionPeriodEnd(subscriptionWithPeriods([], 1_786_909_200)))
      .toEqual(new Date('2026-08-16T19:40:00.000Z'))
  })

  test('returns null when Stripe supplies no billing period', () => {
    expect(stripeSubscriptionPeriodEnd(subscriptionWithPeriods([]))).toBeNull()
  })

  test('uses Stripe flexible billing scheduled cancellation as the access end', () => {
    const subscription = {
      ...subscriptionWithPeriods([1_790_101_200]),
      cancel_at: 1_786_909_200,
    } as Stripe.Subscription

    expect(stripeSubscriptionPeriodEnd(subscription))
      .toEqual(new Date('2026-08-16T19:40:00.000Z'))
  })

  test('treats a scheduled cancellation as canceled while access remains open', () => {
    expect(stripeSubscriptionAccountStatus(subscriptionStatus('active', true))).toBe('canceled')
    expect(stripeSubscriptionAccountStatus({
      status: 'active',
      cancel_at_period_end: false,
      cancel_at: 1_786_909_200,
    } as Stripe.Subscription)).toBe('canceled')
    expect(stripeSubscriptionAccountStatus(subscriptionStatus('active'))).toBe('active')
  })
})
