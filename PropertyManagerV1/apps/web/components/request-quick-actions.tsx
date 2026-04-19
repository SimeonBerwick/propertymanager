'use client'

import { useActionState } from 'react'
import type React from 'react'
import type { MaintenanceRequest } from '@/lib/types'
import { quickRequestAction, type RequestActionState } from '@/lib/request-detail-actions'
import { isStaleClaim } from '@/lib/ui-utils'

const INITIAL_STATE: RequestActionState = { error: null }

function confirmQuickAction(event: React.MouseEvent<HTMLButtonElement>) {
  const action = event.currentTarget.dataset.action
  if (action === 'mark-reassignment-needed') {
    const confirmed = window.confirm(
      'Clear this vendor assignment and mark reassignment needed? This removes current vendor contact details and dispatch state.',
    )

    if (!confirmed) event.preventDefault()
    return
  }

  if (action === 'release-claim') {
    const confirmed = window.confirm('Release this queue claim and return the request to the unclaimed pool?')
    if (!confirmed) event.preventDefault()
  }
}

export function RequestQuickActions({
  request,
  compact = false,
}: {
  request: Pick<MaintenanceRequest, 'id' | 'status' | 'reviewState' | 'assignedVendorName' | 'claimedAt' | 'claimedByUserId'>
  compact?: boolean
}) {
  const [state, action, pending] = useActionState(quickRequestAction, INITIAL_STATE)

  const actions = [
    request.status === 'requested'
      ? { key: 'claim-for-review', label: 'Claim for review', tone: 'button primary', title: 'Claim this request as the next item being reviewed and notify the tenant that it is being looked at.' }
      : null,
    ['approved', 'vendor_selected', 'reopened'].includes(request.status)
      ? { key: 'mark-scheduled', label: 'Mark scheduled', tone: 'button', title: 'Move this request into scheduled status. Use request detail to add the actual time window.' }
      : null,
    ['scheduled', 'vendor_selected'].includes(request.status)
      ? { key: 'start-work', label: 'Start work', tone: 'button', title: 'Move this request into in progress.' }
      : null,
    request.reviewState && request.reviewState !== 'none'
      ? { key: 'needs-follow-up', label: 'Needs follow-up', tone: 'button', title: 'Keep this request in the follow-up queue for operator action.' }
      : null,
    request.assignedVendorName
      ? { key: 'mark-reassignment-needed', label: 'Clear vendor, reassign', tone: 'button', title: 'Clears vendor assignment, contact details, and dispatch state, then marks reassignment needed.' }
      : null,
    request.claimedAt && request.claimedByUserId && isStaleClaim(request)
      ? { key: 'take-over-claim', label: 'Take over claim', tone: 'button', title: 'Reassign stale queue claim ownership to yourself and keep this request moving.' }
      : null,
    request.claimedAt && request.claimedByUserId
      ? { key: 'release-claim', label: 'Release claim', tone: 'button', title: 'Clear queue claim ownership and return this request to the unclaimed pool.' }
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
