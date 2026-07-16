import type Stripe from 'stripe'

export function stripeSubscriptionAccountStatus(subscription: Stripe.Subscription) {
  if (subscription.cancel_at_period_end || subscription.cancel_at || subscription.status === 'canceled') return 'canceled' as const
  if (subscription.status === 'trialing') return 'trialing' as const
  if (subscription.status === 'active') return 'active' as const
  if (['past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(subscription.status)) return 'past_due' as const
  return 'expired' as const
}

export function stripeSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  if (subscription.cancel_at && Number.isFinite(subscription.cancel_at) && subscription.cancel_at > 0) {
    return new Date(subscription.cancel_at * 1000)
  }

  const legacyPeriodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
  const itemPeriodEnds = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value) && value > 0)
  const periodEnd = legacyPeriodEnd ?? (itemPeriodEnds.length > 0 ? Math.min(...itemPeriodEnds) : null)

  return periodEnd ? new Date(periodEnd * 1000) : null
}
