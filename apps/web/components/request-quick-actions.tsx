'use client'

import { useActionState } from 'react'
import type { MaintenanceRequest } from '@/lib/types'
import { quickRequestAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

export function RequestQuickActions({
  request,
  compact = false,
}: {
  request: Pick<MaintenanceRequest, 'id' | 'status' | 'reviewState' | 'assignedVendorName'>
  compact?: boolean
}) {
  const [state, action, pending] = useActionState(quickRequestAction, INITIAL_STATE)

  const actions = [
    request.status === 'new'
      ? { key: 'mark-scheduled', label: 'Mark scheduled', tone: 'button primary' }
      : null,
    request.status !== 'in_progress' && request.status !== 'done'
      ? { key: 'start-work', label: 'Start work', tone: 'button' }
      : null,
    request.reviewState && request.reviewState !== 'none'
      ? { key: 'needs-follow-up', label: 'Needs follow-up', tone: 'button' }
      : null,
    request.assignedVendorName
      ? { key: 'mark-reassignment-needed', label: 'Reassign vendor', tone: 'button' }
      : null,
  ].filter(Boolean) as { key: string; label: string; tone: string }[]

  if (!actions.length) return null

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : undefined }}>
        {actions.map((item) => (
          <form key={item.key} action={action}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="quickAction" value={item.key} />
            <button type="submit" className={item.tone} disabled={pending}>
              {pending ? 'Saving…' : item.label}
            </button>
          </form>
        ))}
      </div>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Quick action applied.</div> : null}
    </div>
  )
}
