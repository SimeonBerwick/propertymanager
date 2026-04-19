import type { RequestStatus } from '@/lib/types'

const LABELS: Record<RequestStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  declined: 'Declined',
  vendor_selected: 'Vendor selected',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  canceled: 'Canceled',
  reopened: 'Reopened',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`badge ${status}`}>{LABELS[status]}</span>
}
