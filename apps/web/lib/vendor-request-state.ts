import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'

type VendorInviteState = {
  status?: string
  awardedAt?: string | Date | null
}

type BillingDocumentLike = {
  status?: string | null
  totalCents: number
  paidCents: number
}

type VendorRequestStateInput = {
  assignedVendorId?: string | null
  requestStatus: string
  viewerVendorId: string
  latestInvite?: VendorInviteState | null
  billingDocuments?: BillingDocumentLike[]
}

export type VendorRequestViewState = {
  canControlDispatch: boolean
  canSeeSchedule: boolean
  shouldShowOccupant: boolean
  isAwardedToViewer: boolean
  isOpenWork: boolean
  isPendingBid: boolean
  statusLabel: string
  tenderLabel: string
  heroNotice:
    | {
        title: string
        detail: string
        tone: 'success' | 'info'
      }
    | null
}

export function deriveVendorRequestViewState(input: VendorRequestStateInput): VendorRequestViewState {
  const inviteStatus = input.latestInvite?.status ?? null
  const inviteAwarded = inviteStatus === 'awarded' || !!input.latestInvite?.awardedAt
  const assignedToViewer = input.assignedVendorId === input.viewerVendorId
  const assignedToAnotherVendor = !!input.assignedVendorId && input.assignedVendorId !== input.viewerVendorId
  const canControlDispatch = assignedToViewer || inviteAwarded
  const isAwardedToViewer = inviteAwarded

  if (['closed', 'declined', 'canceled'].includes(input.requestStatus)) {
    const closeoutLanguage = deriveRequestCloseoutLanguage({
      status: input.requestStatus,
      billingDocuments: input.billingDocuments,
    })
    const statusLabel = closeoutLanguage.vendorLabel

    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer,
      isOpenWork: false,
      isPendingBid: false,
      statusLabel,
      tenderLabel: statusLabel,
      heroNotice: {
        title: statusLabel,
        detail: closeoutLanguage.detail,
        tone: input.requestStatus === 'closed' ? 'success' : 'info',
      },
    }
  }

  if (assignedToAnotherVendor) {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: false,
      isPendingBid: false,
      statusLabel: 'Scheduled with another vendor',
      tenderLabel: 'Another vendor won this job',
      heroNotice: {
        title: 'Another vendor won this job',
        detail: 'This request is no longer assigned to you, so your portal should not show its schedule as active work.',
        tone: 'info',
      },
    }
  }

  if (inviteStatus === 'not_awarded') {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: false,
      isPendingBid: false,
      statusLabel: 'Awarded to another vendor',
      tenderLabel: 'Another vendor won this job',
      heroNotice: {
        title: 'Another vendor won this job',
        detail: 'Your bid is closed out. This request should not remain in your active scheduled queue.',
        tone: 'info',
      },
    }
  }

  if (inviteStatus === 'declined') {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: false,
      isPendingBid: false,
      statusLabel: 'Declined by you',
      tenderLabel: 'You declined this job',
      heroNotice: {
        title: 'You declined this job',
        detail: 'This request is no longer active for your vendor account.',
        tone: 'info',
      },
    }
  }

  if (inviteAwarded) {
    return {
      canControlDispatch: true,
      canSeeSchedule: true,
      shouldShowOccupant: true,
      isAwardedToViewer: true,
      isOpenWork: true,
      isPendingBid: false,
      statusLabel: input.requestStatus === 'scheduled' ? 'Scheduled with you' : 'Vendor chosen for work',
      tenderLabel: 'Vendor chosen for work',
      heroNotice: {
        title: 'Vendor chosen for work',
        detail: 'The property manager chose your company for this work.',
        tone: 'success',
      },
    }
  }

  if (assignedToViewer) {
    return {
      canControlDispatch: true,
      canSeeSchedule: true,
      shouldShowOccupant: true,
      isAwardedToViewer: false,
      isOpenWork: true,
      isPendingBid: false,
      statusLabel: input.requestStatus === 'scheduled' ? 'Scheduled with you' : 'Vendor chosen for work',
      tenderLabel: 'Vendor chosen for work',
      heroNotice: {
        title: 'Vendor chosen for work',
        detail: 'The property manager chose your company for this work.',
        tone: 'info',
      },
    }
  }

  if (inviteStatus === 'bid_submitted') {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: true,
      isPendingBid: false,
      statusLabel: 'Bid submitted',
      tenderLabel: 'Bid submitted',
      heroNotice: {
        title: 'Bid submitted',
        detail: 'Your bid is in. Waiting on the property manager decision.',
        tone: 'info',
      },
    }
  }

  if (inviteStatus === 'viewed') {
    return {
      canControlDispatch: false,
      canSeeSchedule: false,
      shouldShowOccupant: false,
      isAwardedToViewer: false,
      isOpenWork: true,
      isPendingBid: true,
      statusLabel: 'Bid invite opened',
      tenderLabel: 'Bid invite viewed',
      heroNotice: {
        title: 'Bid invite opened',
        detail: 'You have seen the invite, but the property manager has not awarded it yet.',
        tone: 'info',
      },
    }
  }

  return {
    canControlDispatch: false,
    canSeeSchedule: false,
    shouldShowOccupant: false,
    isAwardedToViewer: false,
    isOpenWork: true,
    isPendingBid: inviteStatus === 'invited',
    statusLabel: inviteStatus === 'invited' ? 'Invited to bid' : input.requestStatus.replaceAll('_', ' '),
    tenderLabel: inviteStatus === 'invited' ? 'Invited to bid' : 'Vendor chosen for work',
    heroNotice: inviteStatus === 'invited'
      ? {
          title: 'Invited to bid',
          detail: 'Review the scope, price, and availability before the property manager approves a vendor.',
          tone: 'info',
        }
      : null,
  }
}
