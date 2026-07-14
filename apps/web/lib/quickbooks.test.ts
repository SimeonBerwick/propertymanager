import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createQuickBooksState, quickBooksApprovedLimit, quickBooksAuthorizationUrl, quickBooksContentHash, quickBooksRequestId, quickBooksRetryAt, quickBooksTransactionUrl, quickBooksWebhookRealmIds, verifyQuickBooksState, verifyQuickBooksWebhookSignature } from '@/lib/quickbooks'

describe('QuickBooks integration helpers', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'quickbooks-test-session-secret-at-least-32-characters'
    process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN = 'quickbooks-webhook-test-token'
    delete process.env.QUICKBOOKS_REDIRECT_URI
  })

  it('uses the exact registered callback URL when one is configured', () => {
    process.env.QUICKBOOKS_CLIENT_ID = 'quickbooks-test-client'
    process.env.QUICKBOOKS_CLIENT_SECRET = 'quickbooks-test-secret'
    process.env.QUICKBOOKS_REDIRECT_URI = 'https://www.simeonware.com/api/quickbooks/callback'

    const authorizationUrl = new URL(quickBooksAuthorizationUrl('manager-1'))
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(process.env.QUICKBOOKS_REDIRECT_URI)
  })

  it('renders QuickBooks timestamps in the configured app timezone', () => {
    const source = readFileSync(resolve(process.cwd(), 'app', 'account', 'quickbooks', 'page.tsx'), 'utf8')
    expect(source).toContain('formatDateTime(connection.lastReconciledAt)')
    expect(source).toContain('formatDateTime(connection.lastWebhookAt)')
    expect(source).toContain('formatDateTime(record.nextRetryAt)')
    expect(source).not.toContain('.toLocaleString()')
  })

  it('accepts an intact, recent OAuth state only', () => {
    const now = Date.parse('2026-07-15T12:00:00Z')
    const state = createQuickBooksState('manager-1', now)
    expect(verifyQuickBooksState(state, now + 60_000)).toEqual({ userId: 'manager-1' })
    expect(verifyQuickBooksState(`${state}x`, now + 60_000)).toBeNull()
    expect(verifyQuickBooksState(state, now + 11 * 60_000)).toBeNull()
  })

  it('creates stable source hashes and environment-specific transaction links', () => {
    expect(quickBooksContentHash({ amount: 5000 })).toBe(quickBooksContentHash({ amount: 5000 }))
    expect(quickBooksContentHash({ amount: 5000 })).not.toBe(quickBooksContentHash({ amount: 5001 }))
    expect(quickBooksTransactionUrl('sandbox', 'Bill', '12')).toContain('sandbox.qbo.intuit.com/app/bill?txnId=12')
    expect(quickBooksTransactionUrl('production', 'Invoice', '14')).toContain('qbo.intuit.com/app/invoice?txnId=14')
  })

  it('uses stable, Intuit-safe request IDs and bounded retry delays', () => {
    const requestId = quickBooksRequestId('sync-record-1')
    expect(requestId).toBe(quickBooksRequestId('sync-record-1'))
    expect(requestId).not.toBe(quickBooksRequestId('sync-record-2'))
    expect(requestId.length).toBeLessThanOrEqual(50)
    const now = new Date('2026-07-15T12:00:00Z')
    expect(quickBooksRetryAt(1, now).toISOString()).toBe('2026-07-15T12:15:00.000Z')
    expect(quickBooksRetryAt(99, now).toISOString()).toBe('2026-07-16T12:00:00.000Z')
  })

  it('accepts only correctly signed QuickBooks webhook payloads', () => {
    const payload = JSON.stringify({ eventNotifications: [{ realmId: '123' }] })
    const signature = createHmac('sha256', process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN!).update(payload).digest('base64')
    expect(verifyQuickBooksWebhookSignature(payload, signature)).toBe(true)
    expect(verifyQuickBooksWebhookSignature(`${payload} `, signature)).toBe(false)
    expect(verifyQuickBooksWebhookSignature(payload, null)).toBe(false)
  })

  it('recognizes current and legacy QuickBooks webhook company IDs', () => {
    expect(quickBooksWebhookRealmIds([
      { intuitaccountid: '310687', type: 'qbo.bill.updated.v1' },
      { intuitaccountid: '310687', type: 'qbo.payment.created.v1' },
    ])).toEqual(['310687'])
    expect(quickBooksWebhookRealmIds({ eventNotifications: [{ realmId: '123' }, { realmId: '456' }] })).toEqual(['123', '456'])
    expect(quickBooksWebhookRealmIds({ unexpected: true })).toEqual([])
  })

  it('only exposes amounts covered by manager financial approval', () => {
    expect(quickBooksApprovedLimit({ recipientType: 'tenant', tenantBillbackDecision: 'bill_tenant', tenantBillbackAmountCents: 5000 })).toBe(5000)
    expect(quickBooksApprovedLimit({ recipientType: 'tenant', tenantBillbackDecision: 'none', tenantBillbackAmountCents: 5000 })).toBe(0)
    expect(quickBooksApprovedLimit({ recipientType: 'vendor', vendorCommercialItems: [
      { itemType: 'service_fee', status: 'approved', amountCents: 45000 },
      { itemType: 'bill_to_property_manager', status: 'approved', amountCents: 50000 },
    ] })).toBe(50000)
    expect(quickBooksApprovedLimit({ recipientType: 'vendor', vendorCommercialItems: [{ itemType: 'service_fee', status: 'submitted', amountCents: 45000 }] })).toBe(0)
  })
})
