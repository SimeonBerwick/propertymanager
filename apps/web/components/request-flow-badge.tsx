import { getRequestFlowState } from '@/lib/ui-utils'
import type { MaintenanceRequest } from '@/lib/types'

const LABELS: Record<string, string> = {
  requested: 'Needs triage',
  approved: 'Approved',
  declined: 'Declined',
  vendor_selected: 'Vendor selected',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  canceled: 'Canceled',
  reopened: 'Reopened',
  'scheduled-today': 'Today',
  overdue: 'Overdue',
  'follow-up': 'Follow up',
  review: 'Review',
}

export function RequestFlowBadge({ request }: { request: Pick<MaintenanceRequest, 'status' | 'reviewState' | 'vendorScheduledEnd' | 'vendorScheduledStart'> }) {
  const state = getRequestFlowState(request)
  return <span className={`badge flow-${state}`}>{LABELS[state] ?? state}</span>
}
