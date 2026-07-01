import type { RequestStatus } from '@/lib/types'

export type RequestPaymentState = 'none' | 'unpaid' | 'paid'
export type RequestCloseoutPhase = 'open' | 'completed' | 'closed' | 'inactive'

type BillingDocumentLike = {
  status?: string | null
  totalCents: number
  paidCents: number
}

export type RequestCloseoutLanguageInput = {
  status: RequestStatus | string
  billingDocuments?: BillingDocumentLike[]
  outstandingCents?: number | null
  paidInFull?: boolean | null
}

export type RequestCloseoutLanguage = {
  phase: RequestCloseoutPhase
  paymentState: RequestPaymentState
  primaryLabel: string
  managerLabel: string
  vendorLabel: string
  tenantLabel: string
  detail: string
  isOpen: boolean
  isTerminal: boolean
  isPaid: boolean
  isUnpaid: boolean
}

const BASE_LABELS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Ready for vendor',
  declined: 'Declined',
  vendor_selected: 'Vendor selected',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  canceled: 'Canceled',
  reopened: 'Reopened',
}

const TENANT_BASE_LABELS: Record<string, string> = {
  requested: 'Sent to your property manager',
  approved: 'Approved and being arranged',
  declined: 'Not approved',
  vendor_selected: 'Vendor being scheduled',
  scheduled: 'Visit scheduled',
  in_progress: 'Work in progress',
  completed: 'Work completed',
  closed: 'Closed',
  canceled: 'Canceled',
  reopened: 'Reopened for follow-up',
}

function titleCaseStatus(status: string) {
  return BASE_LABELS[status] ?? status.replaceAll('_', ' ')
}

function derivePhase(status: string): RequestCloseoutPhase {
  if (status === 'completed') return 'completed'
  if (status === 'closed') return 'closed'
  if (status === 'declined' || status === 'canceled') return 'inactive'
  return 'open'
}

function derivePaymentState(input: RequestCloseoutLanguageInput): RequestPaymentState {
  if (input.paidInFull === true) return 'paid'
  const explicitOutstanding = input.outstandingCents ?? null
  if (explicitOutstanding != null) return explicitOutstanding > 0 ? 'unpaid' : 'paid'

  const documents = input.billingDocuments?.filter((document) => document.status !== 'void') ?? []
  if (!documents.length) return 'none'

  const balanceCents = documents.reduce((sum, document) => sum + Math.max(document.totalCents - document.paidCents, 0), 0)
  return balanceCents > 0 ? 'unpaid' : 'paid'
}

export function deriveRequestCloseoutLanguage(input: RequestCloseoutLanguageInput): RequestCloseoutLanguage {
  const status = input.status
  const phase = derivePhase(status)
  const paymentState = derivePaymentState(input)
  const isPaid = paymentState === 'paid'
  const isUnpaid = paymentState === 'unpaid'

  if (phase === 'closed') {
    const managerLabel = isPaid ? 'Closed - paid' : isUnpaid ? 'Closed - payment open' : 'Closed'
    const vendorLabel = isPaid ? 'Paid and closed' : isUnpaid ? 'Closed - payment open' : 'Closed'
    const tenantLabel = isPaid ? 'Closed - paid' : isUnpaid ? 'Closed - balance due' : 'Closed'
    return {
      phase,
      paymentState,
      primaryLabel: managerLabel,
      managerLabel,
      vendorLabel,
      tenantLabel,
      detail: isPaid
        ? 'The request is closed and payment is recorded.'
        : isUnpaid
          ? 'The request is closed, but a payment balance is still open.'
          : 'The request is closed and no further action is expected.',
      isOpen: false,
      isTerminal: true,
      isPaid,
      isUnpaid,
    }
  }

  if (phase === 'completed') {
    const managerLabel = isPaid ? 'Ready to close - paid' : isUnpaid ? 'Payment open' : 'Ready to close'
    const vendorLabel = isPaid ? 'Completed - paid' : isUnpaid ? 'Completed - payment open' : 'Completed'
    const tenantLabel = isPaid ? 'Work completed - paid' : isUnpaid ? 'Work completed - balance due' : 'Work completed'
    return {
      phase,
      paymentState,
      primaryLabel: managerLabel,
      managerLabel,
      vendorLabel,
      tenantLabel,
      detail: isPaid
        ? 'The work is complete, payment is recorded, and the request is ready to close.'
        : isUnpaid
          ? 'The work is complete, but a payment balance is still open.'
          : 'The work is complete and ready for final review.',
      isOpen: false,
      isTerminal: false,
      isPaid,
      isUnpaid,
    }
  }

  if (phase === 'inactive') {
    const primaryLabel = titleCaseStatus(status)
    return {
      phase,
      paymentState: 'none',
      primaryLabel,
      managerLabel: primaryLabel,
      vendorLabel: primaryLabel,
      tenantLabel: TENANT_BASE_LABELS[status] ?? primaryLabel,
      detail: 'This request is no longer active.',
      isOpen: false,
      isTerminal: true,
      isPaid: false,
      isUnpaid: false,
    }
  }

  const primaryLabel = titleCaseStatus(status)
  return {
    phase,
    paymentState,
    primaryLabel,
    managerLabel: primaryLabel,
    vendorLabel: primaryLabel,
    tenantLabel: TENANT_BASE_LABELS[status] ?? primaryLabel,
    detail: 'This request is still open.',
    isOpen: true,
    isTerminal: false,
    isPaid,
    isUnpaid,
  }
}
