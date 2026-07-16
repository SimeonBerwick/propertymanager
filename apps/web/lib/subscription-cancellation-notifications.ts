import type Stripe from 'stripe'
import { BILLING_PLANS, CADENCE_LABELS, parseCadence, parseStoredPlan } from '@/lib/billing-plans'
import type { NotificationMessage } from '@/lib/notify'
import { stripeSubscriptionPeriodEnd } from '@/lib/stripe-subscription-period'

const FEEDBACK_LABELS: Record<string, string> = {
  customer_service: 'Customer service',
  low_quality: 'Quality did not meet expectations',
  missing_features: 'Missing features',
  other: 'Other reason',
  switched_service: 'Switched to another service',
  too_complex: 'Too difficult to use',
  too_expensive: 'Too expensive',
  unused: 'No longer needed',
}

function dateLabel(date: Date | null) {
  return date?.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }) ?? null
}

export function subscriptionCancellationTransition(
  subscription: Stripe.Subscription,
  previousAttributes?: Partial<Stripe.Subscription> | null,
) {
  if (subscription.cancellation_details?.reason !== 'cancellation_requested') return false
  if (subscription.status === 'canceled') return true
  if (!subscription.cancel_at_period_end) return false
  return previousAttributes?.cancel_at_period_end === false
    || (previousAttributes != null
      && Object.prototype.hasOwnProperty.call(previousAttributes, 'cancel_at')
      && previousAttributes.cancel_at !== subscription.cancel_at)
}

export function subscriptionCancellationDeliveryKey(subscription: Stripe.Subscription) {
  const effectiveEnd = stripeSubscriptionPeriodEnd(subscription)
  const timestamp = subscription.canceled_at
    ?? (effectiveEnd
    ? Math.floor(effectiveEnd.getTime() / 1000)
    : subscription.cancel_at ?? subscription.ended_at ?? subscription.created)
  return `${subscription.id}:${timestamp}`
}

export function buildSubscriptionCancellationMessages(input: {
  email: string
  displayName?: string | null
  subscription: Stripe.Subscription
  fallbackPlan?: string | null
  fallbackCadence?: string | null
  accountUrl: string
}) {
  const { subscription } = input
  const plan = parseStoredPlan(subscription.metadata?.plan ?? input.fallbackPlan)
  const cadence = parseCadence(subscription.metadata?.cadence ?? input.fallbackCadence ?? null)
  const planLabel = plan ? BILLING_PLANS[plan].name : 'Simeonware'
  const cadenceLabel = cadence ? CADENCE_LABELS[cadence].toLowerCase() : 'subscription'
  const accessEnd = dateLabel(stripeSubscriptionPeriodEnd(subscription))
  const feedback = subscription.cancellation_details?.feedback
  const comment = subscription.cancellation_details?.comment?.trim()
  const reason = feedback ? FEEDBACK_LABELS[feedback] ?? feedback.replaceAll('_', ' ') : 'No reason supplied'
  const greeting = input.displayName?.trim() ? `Hi ${input.displayName.trim()},` : 'Hello,'
  const accessSentence = accessEnd
    ? `You can continue using Simeonware through ${accessEnd}.`
    : 'Your paid subscription access has ended.'

  const customer: NotificationMessage = {
    to: input.email,
    replyTo: 'support@simeonware.com',
    subject: 'Your Simeonware subscription cancellation is confirmed',
    text: [
      greeting,
      '',
      `Your ${planLabel} ${cadenceLabel} subscription has been canceled and will not renew.`,
      accessSentence,
      'No further subscription charge will be made unless you choose a new plan.',
      '',
      `Review your account: ${input.accountUrl}`,
      '',
      'Questions? Reply to this email and our support team will help.',
      '',
      'Simeonware Support',
    ].join('\n'),
    actionUrl: input.accountUrl,
  }

  const support: NotificationMessage = {
    to: 'support@simeonware.com',
    replyTo: input.email,
    subject: `Simeonware subscription canceled: ${input.email}`,
    text: [
      'A customer canceled a Simeonware subscription.',
      '',
      `Customer: ${input.displayName?.trim() || 'Not provided'}`,
      `Email: ${input.email}`,
      `Plan: ${planLabel}`,
      `Cadence: ${cadenceLabel}`,
      `Access through: ${accessEnd ?? 'Canceled immediately'}`,
      `Reason: ${reason}`,
      comment ? `Customer comment: ${comment}` : '',
      `Stripe subscription: ${subscription.id}`,
      '',
      `Account: ${input.accountUrl}`,
    ].filter(Boolean).join('\n'),
    actionUrl: input.accountUrl,
  }

  return { customer, support }
}
