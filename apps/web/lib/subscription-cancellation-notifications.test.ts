import { describe, expect, test } from 'vitest'
import type Stripe from 'stripe'
import {
  buildSubscriptionCancellationMessages,
  subscriptionCancellationDeliveryKey,
  subscriptionCancellationReasonLabel,
  subscriptionCancellationTransition,
} from '@/lib/subscription-cancellation-notifications'

function cancellationSubscription(overrides: Partial<Stripe.Subscription> = {}) {
  return {
    id: 'sub_cancel_test',
    status: 'active',
    cancel_at_period_end: true,
    cancel_at: 1_786_909_200,
    canceled_at: 1_784_229_600,
    ended_at: null,
    created: 1_784_229_600,
    metadata: { plan: 'starter', cadence: 'monthly' },
    cancellation_details: {
      feedback: 'other',
      comment: 'Live checkout verification only.',
      reason: 'cancellation_requested',
    },
    items: { data: [{ current_period_end: 1_786_909_200 }] },
    ...overrides,
  } as unknown as Stripe.Subscription
}

describe('subscription cancellation notifications', () => {
  test('detects the transition into a scheduled cancellation', () => {
    const subscription = cancellationSubscription()
    expect(subscriptionCancellationTransition(subscription, { cancel_at_period_end: false })).toBe(true)
    expect(subscriptionCancellationTransition(subscription, { cancel_at_period_end: true })).toBe(false)
    expect(subscriptionCancellationTransition({ ...subscription, cancel_at_period_end: false }, { cancel_at_period_end: false })).toBe(false)
  })

  test('detects Stripe flexible billing cancellation without cancel_at_period_end', () => {
    const subscription = cancellationSubscription({ cancel_at_period_end: false })

    expect(subscriptionCancellationTransition(subscription, {
      cancel_at: null,
      canceled_at: null,
      cancellation_details: { feedback: null, comment: null, reason: null },
    })).toBe(true)
    expect(subscriptionCancellationTransition(subscription, {
      cancellation_details: { feedback: null, comment: null, reason: 'cancellation_requested' },
    })).toBe(false)
  })

  test('does not describe a failed-payment cancellation as customer requested', () => {
    const subscription = cancellationSubscription({
      status: 'canceled',
      cancellation_details: {
        feedback: null,
        comment: null,
        reason: 'payment_failed',
      },
    })

    expect(subscriptionCancellationTransition(subscription)).toBe(false)
  })

  test('uses the cancellation request time for a stable cross-event delivery key', () => {
    const scheduled = cancellationSubscription()
    const deleted = cancellationSubscription({ status: 'canceled', cancel_at: null })
    expect(subscriptionCancellationDeliveryKey(scheduled)).toBe('sub_cancel_test:1784229600')
    expect(subscriptionCancellationDeliveryKey(deleted)).toBe(subscriptionCancellationDeliveryKey(scheduled))
  })

  test('builds clear customer and support messages with the reason and access date', () => {
    const messages = buildSubscriptionCancellationMessages({
      email: 'manager@example.com',
      displayName: 'Morgan',
      subscription: cancellationSubscription(),
      accountUrl: 'https://www.simeonware.com/account/subscription',
    })

    expect(messages.customer).toMatchObject({
      to: 'manager@example.com',
      replyTo: 'support@simeonware.com',
      subject: 'Your Simeonware subscription cancellation is confirmed',
    })
    expect(messages.customer.text).toContain('will not renew')
    expect(messages.customer.text).toContain('August 16, 2026')
    expect(messages.support).toMatchObject({
      to: 'support@simeonware.com',
      replyTo: 'manager@example.com',
    })
    expect(messages.support.text).toContain('Reason: Other reason')
    expect(messages.support.text).toContain('Customer comment: Live checkout verification only.')
  })

  test('describes a customer cancellation truthfully when Stripe omits portal feedback', () => {
    const subscription = cancellationSubscription({
      cancellation_details: {
        feedback: null,
        comment: null,
        reason: 'cancellation_requested',
      },
    })

    expect(subscriptionCancellationReasonLabel(subscription)).toBe(
      'Customer requested cancellation (no survey reason supplied)',
    )
  })
})
