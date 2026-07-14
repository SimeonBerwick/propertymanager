import { prisma } from '@/lib/prisma'
import { automaticPlanForUnits, billedAmountForUnits, BILLING_PLANS, purchasedUnitCapacity, type CadenceKey } from '@/lib/billing-plans'
import { getStripeClient } from '@/lib/stripe'
import { writeAuditLog } from '@/lib/audit-log'
import { assertEmergencyFeatureEnabled } from '@/lib/feature-switches'
import { stableOperationKey } from '@/lib/external-operations'

export type UnitPricingSyncResult = {
  userId: string
  activeUnits: number
  purchasedCapacity: number
  plan: string | null
  amountCents: number | null
  stripeUpdated: boolean
}

export async function syncSubscriptionUnitPricing(userId: string, requestedCapacity?: number, requirePayment = false): Promise<UnitPricingSyncResult> {
  const [user, activeUnits] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { subscriptionPlan: true, billingCadence: true, subscriptionStatus: true, stripeSubscriptionId: true, additionalUnitAllowance: true } }),
    prisma.unit.count({ where: { isActive: true, locationType: 'residential', property: { ownerId: userId, isActive: true } } }),
  ])
  if (!user?.subscriptionPlan || !user.billingCadence) return { userId, activeUnits, purchasedCapacity: 0, plan: user?.subscriptionPlan ?? null, amountCents: null, stripeUpdated: false }

  const currentCapacity = purchasedUnitCapacity(user.subscriptionPlan, user.additionalUnitAllowance)
  const targetCapacity = Math.max(currentCapacity, Math.floor(requestedCapacity ?? currentCapacity))
  const plan = automaticPlanForUnits(user.subscriptionPlan, targetCapacity)
  const includedUnits = BILLING_PLANS[plan].unitLimit ?? 0
  const additionalUnitAllowance = Math.max(0, targetCapacity - includedUnits)
  const purchasedCapacity = includedUnits + additionalUnitAllowance
  const cadence = user.billingCadence as CadenceKey
  const amountCents = billedAmountForUnits(plan, cadence, targetCapacity)
  let stripeUpdated = false
  const stripe = getStripeClient()

  const canUpdateStripe = Boolean(stripe && user.stripeSubscriptionId && ['active', 'trialing', 'past_due'].includes(user.subscriptionStatus))
  if (requirePayment && targetCapacity > currentCapacity && !canUpdateStripe) throw new Error('Start a paid subscription before purchasing additional unit capacity.')
  if (stripe && user.stripeSubscriptionId && ['active', 'trialing', 'past_due'].includes(user.subscriptionStatus)) {
    assertEmergencyFeatureEnabled('stripeWrites')
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    const item = subscription.items.data[0]
    if (!item) throw new Error('The Stripe subscription has no recurring plan item.')
    const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product.id
    const interval = cadence === 'annual' ? 'year' : 'month'
    const priceAlreadyMatches = item.price.unit_amount === amountCents && item.price.recurring?.interval === interval
    const metadataAlreadyMatches = subscription.metadata.plan === plan && subscription.metadata.purchasedCapacity === String(purchasedCapacity)
    if (!priceAlreadyMatches || !metadataAlreadyMatches) {
      const operationKey = stableOperationKey(userId, subscription.id, item.price.id, plan, cadence, purchasedCapacity, amountCents)
      await stripe.subscriptions.update(subscription.id, {
        items: [{
          id: item.id,
          quantity: 1,
          price_data: { currency: 'usd', product: productId, unit_amount: amountCents, recurring: { interval } },
        }],
        metadata: { ...subscription.metadata, userId, plan, cadence, purchasedCapacity: String(purchasedCapacity), additionalUnitAllowance: String(additionalUnitAllowance) },
        proration_behavior: 'always_invoice',
        payment_behavior: 'error_if_incomplete',
      }, { idempotencyKey: `subscription-price-${operationKey}` })
      stripeUpdated = true
    }
  }

  if (user.subscriptionPlan !== plan || user.additionalUnitAllowance !== additionalUnitAllowance) {
    await prisma.user.update({ where: { id: userId }, data: { subscriptionPlan: plan, additionalUnitAllowance } })
  }
  if (stripeUpdated || user.subscriptionPlan !== plan || user.additionalUnitAllowance !== additionalUnitAllowance) {
    await writeAuditLog({
      orgId: userId,
      actorUserId: userId,
      entityType: 'user',
      entityId: userId,
      action: 'subscription.unitPricingUpdated',
      summary: `Updated subscription to ${plan} with capacity for ${purchasedCapacity} active units.`,
      metadata: { plan, cadence, activeUnits, purchasedCapacity, additionalUnitAllowance, amountCents, stripeUpdated },
    })
  }
  return { userId, activeUnits, purchasedCapacity, plan, amountCents, stripeUpdated }
}

export async function syncAllSubscriptionUnitPricing() {
  const users = await prisma.user.findMany({ where: { subscriptionPlan: { not: null }, subscriptionStatus: { in: ['trialing', 'active', 'past_due'] } }, select: { id: true } })
  let updated = 0; let failed = 0
  for (const user of users) {
    try { const result = await syncSubscriptionUnitPricing(user.id); if (result.stripeUpdated) updated += 1 } catch { failed += 1 }
  }
  return { processed: users.length, updated, failed }
}
