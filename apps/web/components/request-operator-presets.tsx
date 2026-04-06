'use client'

import { useActionState } from 'react'
import type { RequestStatus } from '@/lib/types'
import { reviewVendorUpdateFormAction, updateStatusFormAction, type RequestActionState } from '@/lib/request-detail-actions'
import { reviewStateLabel } from '@/lib/ui-utils'

const INITIAL_STATE: RequestActionState = { error: null }

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Done',
}

export function RequestOperatorPresets({
  requestId,
  currentStatus,
  currentReviewState,
}: {
  requestId: string
  currentStatus: RequestStatus
  currentReviewState?: string
}) {
  const [statusState, statusAction, statusPending] = useActionState(updateStatusFormAction, INITIAL_STATE)
  const [reviewState, reviewAction, reviewPending] = useActionState(reviewVendorUpdateFormAction, INITIAL_STATE)

  const statusPresets = [
    currentStatus !== 'scheduled' ? { toStatus: 'scheduled' as RequestStatus, label: 'Mark ready to schedule' } : null,
    currentStatus !== 'in_progress' ? { toStatus: 'in_progress' as RequestStatus, label: 'Start work' } : null,
    currentStatus !== 'done' ? { toStatus: 'done' as RequestStatus, label: 'Mark done' } : null,
  ].filter(Boolean) as { toStatus: RequestStatus; label: string }[]

  const reviewPresets = [
    { action: 'needs-follow-up', label: 'Needs follow-up' },
    { action: 'approve-completion', label: 'Approve completion' },
    { action: 'reopen-request', label: 'Reopen request' },
    { action: 'mark-reassignment-needed', label: 'Clear vendor, reassign' },
  ]

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        <div className="kicker">Operator presets</div>
        <h3 style={{ margin: '4px 0 0' }}>Fast moves</h3>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="muted">Status now: {STATUS_LABELS[currentStatus]}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {statusPresets.map((preset) => (
            <form key={preset.toStatus} action={statusAction}>
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="fromStatus" value={currentStatus} />
              <input type="hidden" name="toStatus" value={preset.toStatus} />
              <button type="submit" className="button primary" disabled={statusPending}>{statusPending ? 'Saving…' : preset.label}</button>
            </form>
          ))}
        </div>
        {statusState.error ? <div className="notice error">{statusState.error}</div> : null}
        {statusState.success ? <div className="notice success">Status updated.</div> : null}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="muted">Review state: {reviewStateLabel(currentReviewState)}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {reviewPresets.map((preset) => (
            <form key={preset.action} action={reviewAction}>
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="reviewAction" value={preset.action} />
              <input type="hidden" name="reviewNote" value="" />
              <button type="submit" className="button" disabled={reviewPending}>{reviewPending ? 'Applying…' : preset.label}</button>
            </form>
          ))}
        </div>
        {reviewState.error ? <div className="notice error">{reviewState.error}</div> : null}
        {reviewState.success ? <div className="notice success">Review action applied.</div> : null}
      </div>
    </div>
  )
}
