import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('duplicate-proof financial integration wiring', () => {
  it('records Stripe webhook event IDs before processing', () => {
    const route = source('app/api/stripe/webhook/route.ts')
    expect(route).toContain("operationType: 'webhook'")
    expect(route).toContain('operationKey: event.id')
    expect(route).toContain('if (!receipt.shouldProcess)')
    expect(route).toContain('completeExternalOperation(receipt.operation.id')
    expect(route).toContain('failExternalOperation(receipt.id, error)')
    expect(route).toContain('id: `stripe_checkout_${session.id}`')
    expect(route).toContain('checkoutSessionId: session.id')
    expect(route).toContain("operationType: `subscription-cancellation-${input.kind}-email`")
    expect(route).toContain('subscriptionCancellationDeliveryKey(notificationSubscription)')
  })

  it('gives customer, checkout, and subscription writes stable Stripe keys', () => {
    const checkout = source('app/account/subscription/actions.ts')
    const pricing = source('lib/subscription-unit-pricing.ts')
    expect(checkout).toContain('idempotencyKey: `customer-${stableOperationKey(user.id)}`')
    expect(checkout).toContain('idempotencyKey: `checkout-${operationKey}`')
    expect(pricing).toContain('idempotencyKey: `subscription-price-${operationKey}`')
  })

  it('keeps Intuit writes tied to stable request IDs', () => {
    const quickbooks = source('lib/quickbooks.ts')
    expect(quickbooks).toContain('requestid=${encodeURIComponent(quickBooksRequestId(record.id))}')
    expect(quickbooks).toContain('userId_sourceType_sourceId')
  })
})
