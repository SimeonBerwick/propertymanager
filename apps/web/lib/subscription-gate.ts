import type { AccountSubscriptionStatus } from '@prisma/client'

export type SubscriptionGateInput = {
  subscriptionStatus?: AccountSubscriptionStatus | null
  trialEndsAt?: Date | string | null
  subscriptionEndsAt?: Date | string | null
}

export type SubscriptionGateResult =
  | { allowed: true; reason: 'active_subscription' | 'active_trial' | 'not_configured'; expiresAt?: Date }
  | { allowed: false; reason: 'trial_expired' | 'subscription_expired' | 'past_due' | 'canceled' | 'expired'; expiresAt?: Date }

export type SubscriptionCountdownNotice = {
  daysRemaining: number
  expiresAt: Date
  kind: 'trial' | 'subscription'
  title: string
  message: string
}
function parseDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isFuture(date: Date | null, now: Date) {
  return !!date && date.getTime() > now.getTime()
}

export function evaluateSubscriptionGate(input: SubscriptionGateInput, now = new Date()): SubscriptionGateResult {
  const status = input.subscriptionStatus ?? 'trialing'
  const trialEndsAt = parseDate(input.trialEndsAt)
  const subscriptionEndsAt = parseDate(input.subscriptionEndsAt)

  if (status === 'active') {
    if (!subscriptionEndsAt || isFuture(subscriptionEndsAt, now)) {
      return { allowed: true, reason: 'active_subscription', expiresAt: subscriptionEndsAt ?? undefined }
    }

    return { allowed: false, reason: 'subscription_expired', expiresAt: subscriptionEndsAt }
  }

  if (status === 'trialing') {
    if (!trialEndsAt) {
      return { allowed: true, reason: 'not_configured' }
    }

    if (isFuture(trialEndsAt, now)) {
      return { allowed: true, reason: 'active_trial', expiresAt: trialEndsAt }
    }

    return { allowed: false, reason: 'trial_expired', expiresAt: trialEndsAt }
  }

  if (status === 'past_due') {
    return { allowed: false, reason: 'past_due', expiresAt: subscriptionEndsAt ?? undefined }
  }

  if (status === 'canceled') {
    if (isFuture(subscriptionEndsAt, now)) {
      return { allowed: true, reason: 'active_subscription', expiresAt: subscriptionEndsAt ?? undefined }
    }

    return { allowed: false, reason: 'canceled', expiresAt: subscriptionEndsAt ?? undefined }
  }

  return { allowed: false, reason: 'expired', expiresAt: subscriptionEndsAt ?? trialEndsAt ?? undefined }
}

export function subscriptionGateMessage(result: SubscriptionGateResult) {
  if (result.allowed) return null

  switch (result.reason) {
    case 'trial_expired':
      return 'Your free trial has ended. Add a subscription to continue using the landlord dashboard.'
    case 'subscription_expired':
    case 'canceled':
    case 'expired':
      return 'Your subscription is no longer active. Add or renew a subscription to continue.'
    case 'past_due':
      return 'Your subscription payment needs attention before the landlord dashboard can be used.'
  }
}

export function subscriptionCountdownNotice(input: SubscriptionGateInput, now = new Date()): SubscriptionCountdownNotice | null {
  const gate = evaluateSubscriptionGate(input, now)
  if (!gate.allowed || !gate.expiresAt) return null

  const msRemaining = gate.expiresAt.getTime() - now.getTime()
  if (msRemaining <= 0) return null

  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  if (daysRemaining > 7) return null

  const kind = gate.reason === 'active_trial' ? 'trial' : 'subscription'
  const periodLabel = kind === 'trial' ? 'free trial' : 'subscription'
  const dayLabel = daysRemaining === 1 ? '1 day' : daysRemaining + ' days'

  return {
    daysRemaining,
    expiresAt: gate.expiresAt,
    kind,
    title: dayLabel + ' left on your ' + periodLabel,
    message: 'Update billing to keep access active, or request account deletion if you do not want to continue.',
  }
}
