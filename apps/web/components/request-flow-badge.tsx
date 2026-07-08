import { deriveRequestCloseoutLanguage } from '@/lib/request-closeout-language'
import { getRequestFlowState } from '@/lib/ui-utils'
import type { MaintenanceRequest } from '@/lib/types'

const LABELS: Record<string, string> = {
  requested: 'Needs triage',
  approved: 'Ready for vendor bids',
  declined: 'Declined',
  vendor_selected: 'Vendor chosen for service call',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
  canceled: 'Canceled',
  reopened: 'Reopened',
  reassignment: 'Reassign',
  'scheduled-today': 'Today',
  overdue: 'Overdue',
  'follow-up': 'Follow up',
  review: 'Review work',
}

export function RequestFlowBadge({ request }: { request: Pick<MaintenanceRequest, 'status' | 'reviewState' | 'vendorScheduledEnd' | 'vendorScheduledStart'> }) {
  const state = getRequestFlowState(request)
  if (state === 'completed' || state === 'closed') {
    return <span className={`badge flow-${state}`}>{deriveRequestCloseoutLanguage({ status: state }).managerLabel}</span>
  }

  return <span className={`badge flow-${state}`}>{LABELS[state] ?? state}</span>
}
