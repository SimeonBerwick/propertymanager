import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripeClient, getStripeWebhookSecret } from '@/lib/stripe'
import { parseCadence, parsePlan } from '@/lib/billing-plans'

function accountStatusFromStripe(status?: string | null) {
  switch (status) {
    case 'trialing':
      return 'trialing' as const
    case 'active':
      return 'active' as const
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'past_due' as const
    case 'canceled':
      return 'canceled' as const
    default:
      return 'expired' as const
  }
}

function periodEndDate(subscription: Stripe.Subscription) {
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
  return periodEnd ? new Date(periodEnd * 1000) : null
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  const plan = parsePlan(subscription.metadata?.plan ?? null)
  const cadence = parseCadence(subscription.metadata?.cadence ?? null)
  const data = {
    subscriptionStatus: accountStatusFromStripe(subscription.status),
    subscriptionPlan: plan ?? undefined,
    billingCadence: cadence ?? undefined,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    subscriptionEndsAt: periodEndDate(subscription),
  }

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data,
    })
    return
  }

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data,
  })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripeClient()
  const userId = session.metadata?.userId
  const plan = parsePlan(session.metadata?.plan ?? null)
  const cadence = parseCadence(session.metadata?.cadence ?? null)

  if (!stripe || !userId) return

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await syncSubscription(subscription)
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'active',
      subscriptionPlan: plan ?? undefined,
      billingCadence: cadence ?? undefined,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    },
  })
}

export async function POST(request: Request) {
  const stripe = getStripeClient()
  const webhookSecret = getStripeWebhookSecret()
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const body = await request.text()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('[stripe:webhook] signature verification failed', error)
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await syncSubscription(event.data.object as Stripe.Subscription)
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      await prisma.user.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          subscriptionStatus: 'canceled',
          subscriptionEndsAt: periodEndDate(subscription) ?? new Date(),
        },
      })
    }
  } catch (error) {
    console.error('[stripe:webhook] handler failed', error)
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
