export type RequestStatus = 'requested' | 'approved' | 'declined' | 'vendor_selected' | 'scheduled' | 'in_progress' | 'completed' | 'closed' | 'canceled' | 'reopened'
export type Urgency = 'low' | 'medium' | 'high' | 'urgent'
export type CurrencyOption = 'usd' | 'peso' | 'pound' | 'euro'
export type LanguageOption = 'english' | 'spanish' | 'french'
export type DispatchStatus = 'assigned' | 'contacted' | 'accepted' | 'scheduled' | 'in_progress' | 'completed' | 'declined' | 'canceled'
export type PhotoSource = 'tenant' | 'landlord' | 'vendor'
export type ReviewStatus = 'none' | 'needs_follow_up' | 'vendor_update_pending_review' | 'vendor_completed_pending_review' | 'reassignment_needed' | 'vendor_declined_reassignment_needed' | 'approved' | 'reopened_after_review'
export type TenantBillbackDecision = 'none' | 'bill_tenant' | 'waived'
export type BidSource = 'vendor_submitted' | 'manager_entered'

export interface Property {
  id: string
  name: string
  address: string
  isActive: boolean
  unitCount: number
}

export interface Unit {
  id: string
  propertyId: string
  label: string
  tenantName?: string
  tenantEmail?: string
  isActive: boolean
}

export interface MaintenancePhoto {
  id: string
  imageUrl: string
  source: PhotoSource
  sourceLabel?: string
  dispatchEventId?: string
  createdAt: string
}

export interface MaintenanceRequest {
  id: string
  propertyId: string
  unitId: string
  submittedByName?: string
  submittedByEmail?: string
  preferredCurrency: CurrencyOption
  preferredLanguage: LanguageOption
  title: string
  description: string
  category: string
  urgency: Urgency
  status: RequestStatus
  assignedVendorId?: string
  assignedVendorName?: string
  assignedVendorEmail?: string
  assignedVendorPhone?: string
  assignedVendorIds?: string[]
  assignedVendorNames?: string[]
  dispatchStatus?: DispatchStatus
  vendorScheduledStart?: string
  vendorScheduledEnd?: string
  actualCompletedAt?: string
  reviewState?: ReviewStatus
  reviewNote?: string
  declineReason?: string
  tenantBillbackDecision?: TenantBillbackDecision
  tenantBillbackAmountCents?: number
  tenantBillbackReason?: string
  tenantBillbackDecidedAt?: string
  autoFlag?: string
  autoFlaggedAt?: string
  firstReviewedAt?: string
  claimedAt?: string
  claimedByUserId?: string
  claimedByUserName?: string
  slaBucket?: string
  triageTags: string[]
  createdAt: string
  closedAt?: string
  cancelReason?: string
  reopenedReason?: string
}

export interface Vendor {
  id: string
  orgId?: string
  name: string
  email?: string
  phone?: string
  categories: string[]
  supportedLanguages: LanguageOption[]
  supportedCurrencies: CurrencyOption[]
  isActive: boolean
}

export interface RequestComment {
  id: string
  requestId: string
  authorName: string
  body: string
  visibility: 'internal' | 'external'
  createdAt: string
}

export interface VendorDispatchEvent {
  id: string
  requestId: string
  vendorName?: string
  actorName: string
  status: DispatchStatus
  note?: string
  scheduledStart?: string
  scheduledEnd?: string
  createdAt: string
}

export interface TenderInviteView {
  id: string
  vendorId: string
  vendorName: string
  vendorEmail?: string
  status: string
  bidAmountCents?: number
  bidCurrency?: CurrencyOption
  bidSource?: BidSource
  availabilityNote?: string
  proposedStart?: string
  proposedEnd?: string
  invitedAt: string
  respondedAt?: string
  awardedAt?: string
}

export interface RequestTenderView {
  id: string
  status: string
  title?: string
  note?: string
  sentAt?: string
  awardedAt?: string
  createdAt: string
  invites: TenderInviteView[]
}

export interface StatusEvent {
  id: string
  requestId: string
  fromStatus?: RequestStatus
  toStatus: RequestStatus
  actorName: string
  createdAt: string
}

const CURRENCY_LABELS: Record<CurrencyOption, string> = {
  usd: 'USD',
  peso: 'Peso',
  pound: 'Pound',
  euro: 'Euro',
}

const LANGUAGE_LABELS: Record<LanguageOption, string> = {
  english: 'English',
  spanish: 'Spanish',
  french: 'French',
}

export function currencyLabel(value: CurrencyOption): string {
  return CURRENCY_LABELS[value]
}

export function languageLabel(value: LanguageOption): string {
  return LANGUAGE_LABELS[value]
}
