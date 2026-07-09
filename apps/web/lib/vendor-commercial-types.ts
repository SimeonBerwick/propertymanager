import type { CurrencyOption } from '@/lib/types'

export type VendorCommercialType = 'bid' | 'service_fee' | 'overcost' | 'bill_to_property_manager'
export type VendorCommercialStatus = 'submitted' | 'approved' | 'declined'
export type VendorPaymentTiming = 'on_completion' | 'due_now' | 'deposit_50' | 'before_work'

export interface VendorCommercialItemView {
  id: string
  requestId: string
  vendorId: string
  vendorName?: string
  itemType: VendorCommercialType
  status: VendorCommercialStatus
  paymentTiming: VendorPaymentTiming
  currency: CurrencyOption
  amountCents: number
  title: string
  description?: string
  attachmentUrl?: string
  attachmentName?: string
  attachmentContentType?: string
  submittedAt: string
  createdAt: string
}

export const VENDOR_PAYMENT_TIMING_LABELS: Record<VendorPaymentTiming, string> = {
  on_completion: 'Pay on completion',
  due_now: 'Due now',
  deposit_50: '50% before work, 50% on completion',
  before_work: 'Pay before work starts',
}

export function normalizeVendorPaymentTiming(value?: string | null): VendorPaymentTiming {
  if (value === 'due_now' || value === 'deposit_50' || value === 'before_work') return value
  return 'on_completion'
}

export function vendorPaymentTimingLabel(value?: string | null) {
  return VENDOR_PAYMENT_TIMING_LABELS[normalizeVendorPaymentTiming(value)]
}

export function vendorPaymentTimingRequiresUpfront(value?: string | null) {
  const timing = normalizeVendorPaymentTiming(value)
  return timing === 'due_now' || timing === 'deposit_50' || timing === 'before_work'
}

export function upfrontPaymentCents(amountCents: number, value?: string | null) {
  const timing = normalizeVendorPaymentTiming(value)
  if (timing === 'deposit_50') return Math.ceil(amountCents / 2)
  if (timing === 'due_now' || timing === 'before_work') return amountCents
  return 0
}

export function vendorCommercialTypeLabel(value: VendorCommercialType) {
  switch (value) {
    case 'bid':
      return 'Bid'
    case 'service_fee':
      return 'Service fee'
    case 'overcost':
      return 'Extra cost'
    case 'bill_to_property_manager':
      return 'Invoice property manager'
    default:
      return value
  }
}

export function vendorCommercialStatusLabel(value: VendorCommercialStatus) {
  switch (value) {
    case 'submitted':
      return 'Submitted'
    case 'approved':
      return 'Approved'
    case 'declined':
      return 'Declined'
    default:
      return value
  }
}
