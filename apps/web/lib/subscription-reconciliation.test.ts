import { describe, expect, test } from 'vitest'
import type Stripe from 'stripe'
import { selectAuthoritativeSubscription } from '@/lib/subscription-reconciliation'

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
