import { describe, expect, test } from 'vitest'
import { evaluateSubscriptionGate, subscriptionCountdownNotice, subscriptionGateMessage } from '@/lib/subscription-gate'

const NOW = new Date('2026-06-01T14:35:00.000Z')

describe('evaluateSubscriptionGate', () => {
  test('allows existing accounts when no trial or subscription dates are configured', () => {
    expect(evaluateSubscriptionGate({ subscriptionStatus: 'trialing', trialEndsAt: null }, NOW)).toEqual({
      allowed: true,
      reason: 'not_configured',
    })
  })

  test('allows an active free trial before it ends', () => {
    const result = evaluateSubscriptionGate({ subscriptionStatus: 'trialing', trialEndsAt: '2026-06-08T00:00:00.000Z' }, NOW)
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('active_trial')
  })

  test('blocks an expired free trial', () => {
    const result = evaluateSubscriptionGate({ subscriptionStatus: 'trialing', trialEndsAt: '2026-05-31T00:00:00.000Z' }, NOW)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('trial_expired')
    expect(subscriptionGateMessage(result)).toMatch(/free trial has ended/i)
  })

  test('allows an active subscription with no configured end date', () => {
    expect(evaluateSubscriptionGate({ subscriptionStatus: 'active', subscriptionEndsAt: null }, NOW)).toEqual({
      allowed: true,
      reason: 'active_subscription',
      expiresAt: undefined,
    })
  })

  test('blocks explicit billing failure states', () => {
    expect(evaluateSubscriptionGate({ subscriptionStatus: 'past_due' }, NOW)).toMatchObject({ allowed: false, reason: 'past_due' })
    expect(evaluateSubscriptionGate({ subscriptionStatus: 'expired' }, NOW)).toMatchObject({ allowed: false, reason: 'expired' })
  })

  test('allows a canceled subscription through the paid-through date', () => {
    const result = evaluateSubscriptionGate({ subscriptionStatus: 'canceled', subscriptionEndsAt: '2026-06-30T00:00:00.000Z' }, NOW)
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('active_subscription')
  })
})

describe('subscriptionCountdownNotice', () => {
  test('shows a final-week trial countdown', () => {
    const notice = subscriptionCountdownNotice({ subscriptionStatus: 'trialing', trialEndsAt: '2026-06-08T00:00:00.000Z' }, NOW)

    expect(notice).toMatchObject({
      daysRemaining: 7,
      kind: 'trial',
      title: '7 days left on your free trial',
    })
  })

  test('does not show a countdown before the final week', () => {
    expect(subscriptionCountdownNotice({ subscriptionStatus: 'trialing', trialEndsAt: '2026-06-09T14:35:01.000Z' }, NOW)).toBeNull()
  })

  test('shows one day left with singular wording', () => {
    const notice = subscriptionCountdownNotice({ subscriptionStatus: 'active', subscriptionEndsAt: '2026-06-02T14:35:00.000Z' }, NOW)

    expect(notice).toMatchObject({
      daysRemaining: 1,
      kind: 'subscription',
      title: '1 day left on your subscription',
    })
  })
})
