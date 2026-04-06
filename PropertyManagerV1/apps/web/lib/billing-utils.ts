import type { BillingDocumentStatus, BillingDocumentType } from '@/lib/billing-types'
import { currencyLabel } from '@/lib/types'

export function centsFromDollars(value: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

export function formatMoney(cents: number, currency: 'usd' | 'peso' | 'pound' | 'euro') {
  return `${currencyLabel(currency)} ${((cents || 0) / 100).toFixed(2)}`
}

export function deriveBillingStatus(totalCents: number, paidCents: number) {
  if (paidCents <= 0) return 'sent'
  if (paidCents >= totalCents) return 'paid'
  return 'partial'
}

export function billingDocumentTypeLabel(type: BillingDocumentType) {
  switch (type) {
    case 'tenant_invoice':
      return 'Tenant invoice'
    case 'vendor_remittance':
      return 'Vendor remittance'
    default:
      return type
  }
}

export function billingStatusLabel(status: BillingDocumentStatus) {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'sent':
      return 'Sent'
    case 'partial':
      return 'Partially paid'
    case 'paid':
      return 'Paid'
    case 'void':
      return 'Voided'
    default:
      return status
  }
}

export function billingEventLabel(eventType: string) {
  switch (eventType) {
    case 'created':
      return 'Draft created'
    case 'created_and_sent':
      return 'Created and sent'
    case 'resent':
      return 'Resent'
    case 'duplicated':
      return 'Duplicated as draft copy'
    case 'voided':
      return 'Voided'
    case 'payment_state_updated':
      return 'Payment updated'
    default:
      return eventType.replaceAll('_', ' ')
  }
}
