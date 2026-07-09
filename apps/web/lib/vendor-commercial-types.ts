import type { CurrencyOption } from '@/lib/types'

export type VendorCommercialType = 'bid' | 'service_fee' | 'overcost' | 'bill_to_property_manager'
export type VendorCommercialStatus = 'submitted' | 'approved' | 'declined'

export interface VendorCommercialItemView {
  id: string
  requestId: string
  vendorId: string
  vendorName?: string
  itemType: VendorCommercialType
  status: VendorCommercialStatus
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
