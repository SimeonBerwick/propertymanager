'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { Route } from 'next'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { additionalUnitCount, automaticPlanForUnits, billedAmountForUnits, BILLING_PLANS, parseCadence, parsePlan, purchasedUnitCapacity } from '@/lib/billing-plans'
import { getStripeClient } from '@/lib/stripe'
import { writeAuditLog } from '@/lib/audit-log'
import { ANDROID_SUBSCRIPTION_MESSAGE, isAndroidWebView } from '@/lib/android-webview'
import { shouldManageExistingSubscription } from '@/lib/subscription-checkout'
import { syncSubscriptionUnitPricing } from '@/lib/subscription-unit-pricing'
import { assertEmergencyFeatureEnabled } from '@/lib/feature-switches'
import { completeExternalOperation, failExternalOperation, stableOperationKey } from '@/lib/external-operations'

function billingUrl(message?: string) {
  const params = new URLSearchParams()
  if (message) params.set('error', message)
  const query = params.toString()
  return `/account/subscription${query ? `?${query}` : ''}`
}

export type BusinessNameState = {
  error: string | null
  success: string | null
}

export async function increaseUnitAllowanceAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const raw = String(formData.get('additionalUnits') ?? '').trim()
  const additionalUnits = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(additionalUnits) || additionalUnits < 1 || additionalUnits > 5000) {
    redirect('/account/subscription?error=Choose+between+1+and+5000+additional+units.' as Route)
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { subscriptionPlan: true, additionalUnitAllowance: true } })
  if (!user?.subscriptionPlan) redirect('/account/subscription?error=Choose+a+paid+plan+before+increasing+unit+capacity.' as Route)
  const currentCapacity = purchasedUnitCapacity(user.subscriptionPlan, user.additionalUnitAllowance)
  try {
    assertEmergencyFeatureEnabled('stripeWrites')
    await syncSubscriptionUnitPricing(session.userId, currentCapacity + additionalUnits, true)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unit capacity could not be updated.'
    redirect(`/account/subscription?error=${encodeURIComponent(message)}` as Route)
  }
  revalidatePath('/account/subscription')
  redirect('/account/subscription?capacity=updated' as Route)
}

export async function updateBusinessNameAction(
  _previous: BusinessNameState,
  formData: FormData,
): Promise<BusinessNameState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Sign in before updating your business name.', success: null }

  const businessName = String(formData.get('businessName') ?? '').trim()
  if (businessName.length > 160) {
    return { error: 'Business name must be 160 characters or fewer.', success: null }
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { businessName: businessName || null },
    select: { id: true },
  })

  await writeAuditLog({
    orgId: user.id,
    actorUserId: user.id,
    entityType: 'user',
    entityId: user.id,
    action: 'account.businessNameUpdated',
    summary: businessName ? 'Updated vendor-facing business name.' : 'Removed vendor-facing business name.',
  })

  revalidatePath('/account/subscription')
  revalidatePath('/vendor')

  return {
    error: null,
    success: businessName ? 'Business name updated.' : 'Business name removed.',
  }
}

export async function startCheckoutAction(formData: FormData) {
  if (isAndroidWebView((await headers()).get('user-agent'))) {
    redirect(billingUrl(ANDROID_SUBSCRIPTION_MESSAGE) as Route)
  }

  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')

  const plan = parsePlan(formData.get('plan'))
  const cadence = parseCadence(formData.get('cadence'))
  if (!plan || !cadence) redirect(billingUrl('Choose a valid plan.') as Route)

  try {
    assertEmergencyFeatureEnabled('stripeWrites')
  } catch (error) {
    redirect(billingUrl(error instanceof Error ? error.message : 'Subscription changes are temporarily paused.') as Route)
  }

  const stripe = getStripeClient()
  if (!stripe) redirect(billingUrl('Stripe is not configured yet. Set STRIPE_SECRET_KEY to enable checkout.') as Route)

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  })
  if (!user) redirect('/login?error=session-expired')
  const activeUnits = await prisma.unit.count({ where: { isActive: true, locationType: 'residential', property: { ownerId: user.id, isActive: true } } })
  const requestedCapacity = Math.max(BILLING_PLANS[plan].unitLimit ?? 0, activeUnits)
  const billedPlan = automaticPlanForUnits(plan, requestedCapacity)
  const purchasedCapacity = Math.max(requestedCapacity, BILLING_PLANS[billedPlan].unitLimit ?? 0)
  const additionalUnitAllowance = additionalUnitCount(billedPlan, purchasedCapacity)
  const billedAmountCents = billedAmountForUnits(billedPlan, cadence, purchasedCapacity)

  let stripeCustomerId = user.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.displayName ?? undefined,
      metadata: { userId: user.id },
    }, { idempotencyKey: `customer-${stableOperationKey(user.id)}` })
    stripeCustomerId = customer.id
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId },
    })
  }

  const baseUrl = getAppBaseUrl('stripe checkout')
  if (shouldManageExistingSubscription(user)) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/account/subscription`,
    })

    await writeAuditLog({
      orgId: user.id,
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'subscription.planChangeRedirected',
      summary: 'Opened Stripe billing to manage an existing subscription without creating a duplicate.',
      metadata: { requestedPlan: plan, requestedCadence: cadence, stripeSubscriptionId: user.stripeSubscriptionId },
    })

    redirect(portal.url as Route)
  }

  const operationKey = stableOperationKey(user.id, billedPlan, cadence, purchasedCapacity, billedAmountCents)
  const operation = await prisma.externalOperation.upsert({
    where: { provider_operationType_operationKey: { provider: 'stripe', operationType: 'checkout', operationKey } },
    create: { provider: 'stripe', operationType: 'checkout', operationKey, orgId: user.id },
    update: { attemptCount: { increment: 1 } },
  })
  if (operation.resultUrl && operation.expiresAt && operation.expiresAt > new Date()) redirect(operation.resultUrl as Route)

  let checkout
  try {
    checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: billedAmountCents,
            recurring: { interval: cadence === 'annual' ? 'year' : 'month' },
            product_data: {
              name: `Simeonware Maintenance Manager ${BILLING_PLANS[billedPlan].name}`,
              description: `${BILLING_PLANS[billedPlan].description} Capacity for ${purchasedCapacity} active units.`,
            },
          },
        },
      ],
      metadata: { userId: user.id, plan: billedPlan, cadence, purchasedCapacity: String(purchasedCapacity), additionalUnitAllowance: String(additionalUnitAllowance), operationId: operation.id },
      subscription_data: {
        metadata: { userId: user.id, plan: billedPlan, cadence, purchasedCapacity: String(purchasedCapacity), additionalUnitAllowance: String(additionalUnitAllowance) },
      },
      allow_promotion_codes: true,
      success_url: `${baseUrl}/account/subscription?checkout=success`,
      cancel_url: `${baseUrl}/account/subscription?checkout=cancelled`,
    }, { idempotencyKey: `checkout-${operationKey}` })
    await completeExternalOperation(operation.id, {
      providerObjectId: checkout.id,
      resultUrl: checkout.url,
      expiresAt: new Date(checkout.expires_at * 1000),
    })
  } catch (error) {
    await failExternalOperation(operation.id, error).catch(() => null)
    throw error
  }

  await writeAuditLog({
    orgId: user.id,
    actorUserId: user.id,
    entityType: 'user',
    entityId: user.id,
    action: 'subscription.checkoutStarted',
    summary: `Started Stripe Checkout for ${billedPlan} ${cadence}.`,
    metadata: { checkoutSessionId: checkout.id, requestedPlan: plan, plan: billedPlan, cadence, activeUnits, purchasedCapacity, additionalUnitAllowance, billedAmountCents },
  })

  if (!checkout.url) redirect(billingUrl('Stripe did not return a checkout URL.') as Route)
  redirect(checkout.url as Route)
}

export async function openBillingPortalAction() {
  if (isAndroidWebView((await headers()).get('user-agent'))) {
    redirect(billingUrl(ANDROID_SUBSCRIPTION_MESSAGE) as Route)
  }

  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')

  try {
    assertEmergencyFeatureEnabled('stripeWrites')
  } catch (error) {
    redirect(billingUrl(error instanceof Error ? error.message : 'Subscription changes are temporarily paused.') as Route)
  }

  const stripe = getStripeClient()
  if (!stripe) redirect(billingUrl('Stripe is not configured yet. Set STRIPE_SECRET_KEY to enable the billing portal.') as Route)

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, stripeCustomerId: true },
  })
  if (!user?.stripeCustomerId) redirect(billingUrl('No Stripe customer is attached to this account yet.') as Route)

  const baseUrl = getAppBaseUrl('stripe billing portal')
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/account/subscription`,
  })

  redirect(portal.url as Route)
}
