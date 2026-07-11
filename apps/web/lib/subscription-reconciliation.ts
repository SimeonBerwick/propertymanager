import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripeClient } from '@/lib/stripe'
import { parseCadence, parsePlan } from '@/lib/billing-plans'
import { writeAuditLog } from '@/lib/audit-log'

export const RECONCILED_STRIPE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])

export function selectAuthoritativeSubscription(subscriptions: Stripe.Subscription[]) {
  const ordered = [...subscriptions].sort((a, b) => b.created - a.created)
  const tracked = ordered.filter((subscription) => RECONCILED_STRIPE_STATUSES.has(subscription.status))
  return { authoritative: tracked[0] ?? ordered[0] ?? null, simultaneous: tracked }
}

function accountStatus(status: Stripe.Subscription.Status) {
  if (status === 'active') return 'active' as const
  if (status === 'trialing') return 'trialing' as const
  if (status === 'past_due' || status === 'unpaid') return 'past_due' as const
  if (status === 'canceled') return 'canceled' as const
  return 'expired' as const
}

function periodEnd(subscription: Stripe.Subscription) {
  const seconds = (subscription as unknown as { current_period_end?: number }).current_period_end
  return seconds ? new Date(seconds * 1000) : null
}

export interface SubscriptionReconciliationResult {
  checked: number
  repaired: number
  duplicateCustomers: Array<{ userId: string; customerId: string; subscriptionIds: string[] }>
  errors: Array<{ userId: string; message: string }>
}

export async function reconcileStripeSubscriptions(): Promise<SubscriptionReconciliationResult> {
  const stripe = getStripeClient()
  if (!stripe) return { checked: 0, repaired: 0, duplicateCustomers: [], errors: [{ userId: 'system', message: 'Stripe is not configured.' }] }

  const users = await prisma.user.findMany({
    where: { stripeCustomerId: { not: null } },
    select: {
      id: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      billingCadence: true,
      subscriptionEndsAt: true,
    },
  })
  const result: SubscriptionReconciliationResult = { checked: users.length, repaired: 0, duplicateCustomers: [], errors: [] }

  for (const user of users) {
    try {
      const response = await stripe.subscriptions.list({ customer: user.stripeCustomerId!, status: 'all', limit: 20 })
      const { authoritative: subscription, simultaneous: tracked } = selectAuthoritativeSubscription(response.data)
      if (tracked.length > 1) {
        result.duplicateCustomers.push({ userId: user.id, customerId: user.stripeCustomerId!, subscriptionIds: tracked.map((item) => item.id) })
        await writeAuditLog({
          orgId: user.id,
          actorUserId: user.id,
          entityType: 'user',
          entityId: user.id,
          action: 'subscription.duplicateDetected',
          summary: `Detected ${tracked.length} simultaneous Stripe subscriptions.`,
          metadata: { subscriptionIds: tracked.map((item) => item.id) },
        })
      }

      if (!subscription) continue
      const plan = parsePlan(subscription.metadata?.plan) ?? user.subscriptionPlan
      const cadence = parseCadence(subscription.metadata?.cadence) ?? user.billingCadence
      const status = accountStatus(subscription.status)
      const endsAt = periodEnd(subscription)
      const needsRepair = user.stripeSubscriptionId !== subscription.id
        || user.subscriptionStatus !== status
        || user.subscriptionPlan !== plan
        || user.billingCadence !== cadence
        || user.subscriptionEndsAt?.getTime() !== endsAt?.getTime()

      if (needsRepair) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: status,
            subscriptionPlan: plan,
            billingCadence: cadence,
            subscriptionEndsAt: endsAt,
          },
        })
        result.repaired += 1
      }
    } catch (error) {
      result.errors.push({ userId: user.id, message: error instanceof Error ? error.message : 'Unknown Stripe reconciliation error.' })
    }
  }

  return result
}
