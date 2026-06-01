import Stripe from 'stripe'

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) return null
  return new Stripe(secretKey)
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || ''
}
