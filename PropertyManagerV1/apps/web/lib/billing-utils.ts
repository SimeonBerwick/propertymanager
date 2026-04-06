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
