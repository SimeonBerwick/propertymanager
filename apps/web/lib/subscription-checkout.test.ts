import { describe, expect, test } from 'vitest'
import { shouldManageExistingSubscription } from '@/lib/subscription-checkout'

describe('shouldManageExistingSubscription', () => {
  test.each(['active', 'trialing', 'past_due'] as const)(
    'uses billing management for an existing %s subscription',
    (subscriptionStatus) => {
      expect(shouldManageExistingSubscription({ stripeSubscriptionId: 'sub_existing', subscriptionStatus })).toBe(true)
    },
  )

  test('allows checkout when Stripe has no existing subscription', () => {
    expect(shouldManageExistingSubscription({ stripeSubscriptionId: null, subscriptionStatus: 'trialing' })).toBe(false)
  })

  test.each(['canceled', 'expired'] as const)('allows a replacement checkout after %s', (subscriptionStatus) => {
    expect(shouldManageExistingSubscription({ stripeSubscriptionId: 'sub_old', subscriptionStatus })).toBe(false)
  })
})
