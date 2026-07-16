import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripeClient, getStripeWebhookSecret } from '@/lib/stripe'
import { parseCadence, parseStoredPlan } from '@/lib/billing-plans'
import { beginExternalOperation, completeExternalOperation, failExternalOperation } from '@/lib/external-operations'
import { stripeSubscriptionAccountStatus, stripeSubscriptionPeriodEnd } from '@/lib/stripe-subscription-period'
import {
  buildSubscriptionCancellationMessages,
  subscriptionCancellationDeliveryKey,
  subscriptionCancellationTransition,
} from '@/lib/subscription-cancellation-notifications'
import { sendNotification, type NotificationMessage } from '@/lib/notify'
import { getAppBaseUrl } from '@/lib/runtime-env'

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  const plan = parseStoredPlan(subscription.metadata?.plan)
  const cadence = parseCadence(subscription.metadata?.cadence ?? null)
  const additionalUnitAllowance = Math.max(0, Number.parseInt(subscription.metadata?.additionalUnitAllowance ?? '0', 10) || 0)
  const data = {
    subscriptionStatus: stripeSubscriptionAccountStatus(subscription),
    subscriptionPlan: plan ?? undefined,
    billingCadence: cadence ?? undefined,
    additionalUnitAllowance,
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    subscriptionEndsAt: stripeSubscriptionPeriodEnd(subscription),
    trialEndsAt: ['active', 'canceled'].includes(subscription.status) ? null : undefined,
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

async function sendCancellationNotification(input: {
  key: string
  kind: 'customer' | 'support'
  orgId: string
  subscriptionId: string
  message: NotificationMessage
}) {
  const operation = await beginExternalOperation({
    provider: 'stripe',
    operationType: `subscription-cancellation-${input.kind}-email`,
    operationKey: input.key,
    orgId: input.orgId,
  })
  if (!operation.shouldProcess) return

  const result = await sendNotification(input.message, {
    ownerUserId: input.orgId,
    bypassUserPreference: true,
  })
  if (!result.ok) {
    const error = new Error(`The ${input.kind} subscription cancellation email was not delivered.`)
    await failExternalOperation(operation.operation.id, error)
    throw error
  }
  await completeExternalOperation(operation.operation.id, { providerObjectId: input.subscriptionId })
}

async function notifySubscriptionCancellation(subscription: Stripe.Subscription) {
  const stripe = getStripeClient()
  let notificationSubscription = subscription
  if (
    stripe
    && subscription.cancellation_details?.reason === 'cancellation_requested'
    && !subscription.cancellation_details.feedback
    && !subscription.cancellation_details.comment
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, attempt * 250))
      notificationSubscription = await stripe.subscriptions.retrieve(subscription.id)
      if (
        notificationSubscription.cancellation_details?.feedback
        || notificationSubscription.cancellation_details?.comment
      ) break
    }
  }

  const metadataUserId = subscription.metadata?.userId
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const user = metadataUserId
    ? await prisma.user.findUnique({
      where: { id: metadataUserId },
      select: { id: true, email: true, displayName: true, subscriptionPlan: true, billingCadence: true },
    })
    : await prisma.user.findFirst({
      where: { OR: [{ stripeSubscriptionId: subscription.id }, { stripeCustomerId: customerId }] },
      select: { id: true, email: true, displayName: true, subscriptionPlan: true, billingCadence: true },
    })
  if (!user) throw new Error(`No Simeonware account matches canceled Stripe subscription ${subscription.id}.`)

  const accountUrl = `${getAppBaseUrl('subscription cancellation emails')}/account/subscription`
  const messages = buildSubscriptionCancellationMessages({
    email: user.email,
    displayName: user.displayName,
    subscription: notificationSubscription,
    fallbackPlan: user.subscriptionPlan,
    fallbackCadence: user.billingCadence,
    accountUrl,
  })
  const key = subscriptionCancellationDeliveryKey(notificationSubscription)

  await sendCancellationNotification({ key, kind: 'customer', orgId: user.id, subscriptionId: subscription.id, message: messages.customer })
  await sendCancellationNotification({ key, kind: 'support', orgId: user.id, subscriptionId: subscription.id, message: messages.support })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripeClient()
  const userId = session.metadata?.userId
  const plan = parseStoredPlan(session.metadata?.plan)
  const cadence = parseCadence(session.metadata?.cadence ?? null)
  const additionalUnitAllowance = Math.max(0, Number.parseInt(session.metadata?.additionalUnitAllowance ?? '0', 10) || 0)

  const recordSubscriptionStarted = async () => {
    await prisma.productEvent.create({
      data: {
        id: `stripe_checkout_${session.id}`,
        orgId: userId,
        eventName: 'subscription_started',
        metadataJson: JSON.stringify({ plan, cadence, checkoutSessionId: session.id }),
      },
    }).catch(() => null)
  }

  if (!stripe || !userId) return

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await syncSubscription(subscription)
    await recordSubscriptionStarted()
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: 'active',
      subscriptionPlan: plan ?? undefined,
      billingCadence: cadence ?? undefined,
      additionalUnitAllowance,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      trialEndsAt: null,
    },
  })
  await recordSubscriptionStarted()
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
    const receipt = await beginExternalOperation({
      provider: 'stripe',
      operationType: 'webhook',
      operationKey: event.id,
      orgId: typeof event.data.object === 'object' && event.data.object && 'metadata' in event.data.object
        ? String((event.data.object as { metadata?: { userId?: string } }).metadata?.userId ?? '') || null
        : null,
    })
    if (!receipt.shouldProcess) return NextResponse.json({ received: true, duplicate: true })

    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription
      await syncSubscription(subscription)
      const previousAttributes = event.type === 'customer.subscription.updated'
        ? event.data.previous_attributes as Partial<Stripe.Subscription>
        : null
      if (event.type === 'customer.subscription.updated' && subscriptionCancellationTransition(subscription, previousAttributes)) {
        await notifySubscriptionCancellation(subscription)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      await prisma.user.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          subscriptionStatus: 'canceled',
          subscriptionEndsAt: stripeSubscriptionPeriodEnd(subscription) ?? new Date(),
        },
      })
      if (subscriptionCancellationTransition(subscription)) {
        await notifySubscriptionCancellation(subscription)
      }
    }

    await completeExternalOperation(receipt.operation.id, {
      providerObjectId: typeof event.data.object === 'object' && event.data.object && 'id' in event.data.object
        ? String(event.data.object.id)
        : null,
    })
  } catch (error) {
    const receipt = await prisma.externalOperation.findUnique({
      where: { provider_operationType_operationKey: { provider: 'stripe', operationType: 'webhook', operationKey: event.id } },
      select: { id: true },
    }).catch(() => null)
    if (receipt) await failExternalOperation(receipt.id, error).catch(() => null)
    console.error('[stripe:webhook] handler failed', error)
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
