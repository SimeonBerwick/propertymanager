export function shouldManageExistingSubscription(input: {
  stripeSubscriptionId?: string | null
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
}) {
  return Boolean(input.stripeSubscriptionId)
    && ['active', 'trialing', 'past_due'].includes(input.subscriptionStatus)
}
