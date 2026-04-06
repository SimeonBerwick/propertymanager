'use client'

import { useActionState } from 'react'
import type React from 'react'
import type { MaintenanceRequest } from '@/lib/types'
import { quickRequestAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

function confirmQuickAction(event: React.MouseEvent<HTMLButtonElement>) {
  const action = event.currentTarget.dataset.action
  if (action !== 'mark-reassignment-needed') return

  const confirmed = window.confirm(
    'Reassign vendor? This clears the current vendor, contact details, and dispatch state, then marks the request for reassignment.',
  )

  if (!confirmed) event.preventDefault()
}

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
      ? { key: 'mark-scheduled', label: 'Mark scheduled', tone: 'button primary', title: 'Move this request into scheduled status from the queue.' }
      : null,
    request.status === 'new' || request.status === 'scheduled'
      ? { key: 'start-work', label: 'Start work', tone: 'button', title: 'Move this request into in progress.' }
      : null,
    request.reviewState && request.reviewState !== 'none'
      ? { key: 'needs-follow-up', label: 'Needs follow-up', tone: 'button', title: 'Keep this request in the follow-up queue for operator action.' }
      : null,
    request.assignedVendorName
      ? { key: 'mark-reassignment-needed', label: 'Reassign vendor', tone: 'button', title: 'Clears vendor assignment and dispatch state, then marks reassignment needed.' }
      : null,
  ].filter(Boolean) as { key: string; label: string; tone: string; title: string }[]

  if (!actions.length) return null

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : undefined }}>
        {actions.map((item) => (
          <form
            key={item.key}
            action={action}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="quickAction" value={item.key} />
            <button
              type="submit"
              className={item.tone}
              disabled={pending}
              data-action={item.key}
              title={item.title}
              onClick={confirmQuickAction}
            >
              {pending ? 'Saving…' : item.label}
            </button>
          </form>
        ))}
      </div>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">{state.message ?? 'Quick action applied.'} The queue may refresh and move this request.</div> : null}
    </div>
  )
}
