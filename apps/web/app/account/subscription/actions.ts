'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { Route } from 'next'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { BILLING_PLANS, CADENCE_LABELS, parseCadence, parsePlan, planAmountCents, planPriceLabel } from '@/lib/billing-plans'
import { getStripeClient } from '@/lib/stripe'
import { writeAuditLog } from '@/lib/audit-log'
import { ANDROID_SUBSCRIPTION_MESSAGE, isAndroidWebView } from '@/lib/android-webview'

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
  if (!session) redirect('/login')

  const plan = parsePlan(formData.get('plan'))
  const cadence = parseCadence(formData.get('cadence'))
  if (!plan || !cadence) redirect(billingUrl('Choose a valid plan.') as Route)

  const stripe = getStripeClient()
  if (!stripe) redirect(billingUrl('Stripe is not configured yet. Set STRIPE_SECRET_KEY to enable checkout.') as Route)

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, displayName: true, stripeCustomerId: true },
  })
  if (!user) redirect('/login')

  let stripeCustomerId = user.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.displayName ?? undefined,
      metadata: { userId: user.id },
    })
    stripeCustomerId = customer.id
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId },
    })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionPlan: plan,
      billingCadence: cadence,
    },
  })

  const baseUrl = getAppBaseUrl('stripe checkout')
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: planAmountCents(plan, cadence),
          recurring: { interval: cadence === 'annual' ? 'year' : 'month' },
          product_data: {
            name: `Simeonware Maintenance Manager ${BILLING_PLANS[plan].name}`,
            description: `${BILLING_PLANS[plan].description} ${CADENCE_LABELS[cadence]} billing at ${planPriceLabel(plan, cadence)}.`,
          },
        },
      },
    ],
    metadata: { userId: user.id, plan, cadence },
    subscription_data: {
      metadata: { userId: user.id, plan, cadence },
    },
    allow_promotion_codes: true,
    success_url: `${baseUrl}/account/subscription?checkout=success`,
    cancel_url: `${baseUrl}/account/subscription?checkout=cancelled`,
  })

  await writeAuditLog({
    orgId: user.id,
    actorUserId: user.id,
    entityType: 'user',
    entityId: user.id,
    action: 'subscription.checkoutStarted',
    summary: `Started Stripe Checkout for ${plan} ${cadence}.`,
    metadata: { checkoutSessionId: checkout.id, plan, cadence },
  })

  if (!checkout.url) redirect(billingUrl('Stripe did not return a checkout URL.') as Route)
  redirect(checkout.url as Route)
}

export async function openBillingPortalAction() {
  if (isAndroidWebView((await headers()).get('user-agent'))) {
    redirect(billingUrl(ANDROID_SUBSCRIPTION_MESSAGE) as Route)
  }

  const session = await getLandlordSession()
  if (!session) redirect('/login')

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
