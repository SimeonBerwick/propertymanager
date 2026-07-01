import { describe, expect, test } from 'vitest'
import { evaluatePortalSubscriptionAccess } from '@/lib/portal-subscription-access'

const FUTURE_SUBSCRIPTION_END = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

describe('evaluatePortalSubscriptionAccess', () => {
  test('allows portals for an active manager subscription', () => {
    const result = evaluatePortalSubscriptionAccess({
      subscriptionStatus: 'active',
      trialEndsAt: null,
      subscriptionEndsAt: FUTURE_SUBSCRIPTION_END,
    })

    expect(result.allowed).toBe(true)
    expect(result.gate.reason).toBe('active_subscription')
  })

  test('blocks portals when the manager subscription is past due', () => {
    const result = evaluatePortalSubscriptionAccess({
      subscriptionStatus: 'past_due',
      trialEndsAt: null,
      subscriptionEndsAt: FUTURE_SUBSCRIPTION_END,
    })

    expect(result.allowed).toBe(false)
    expect(result.gate.reason).toBe('past_due')
  })

  test('blocks portals when no manager account can be resolved', () => {
    const result = evaluatePortalSubscriptionAccess(null)

    expect(result.allowed).toBe(false)
  })
})
