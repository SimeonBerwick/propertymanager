import { getRequestFlowState } from '@/lib/ui-utils'
import type { MaintenanceRequest } from '@/lib/types'

const LABELS: Record<string, string> = {
  new: 'Needs triage',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  done: 'Done',
  'scheduled-today': 'Today',
  overdue: 'Overdue',
  'follow-up': 'Follow up',
  review: 'Review',
}

export function RequestFlowBadge({ request }: { request: Pick<MaintenanceRequest, 'status' | 'reviewState' | 'vendorScheduledEnd' | 'vendorScheduledStart'> }) {
  const state = getRequestFlowState(request)
  return <span className={`badge flow-${state}`}>{LABELS[state] ?? state}</span>
}
