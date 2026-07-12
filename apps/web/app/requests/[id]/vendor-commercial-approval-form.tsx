'use client'

import { useActionState } from 'react'
import { approveVendorCommercialItemAction, requestVendorCommercialRevisionAction, type RequestActionState } from '@/lib/request-detail-actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: RequestActionState = { error: null }

export function VendorCommercialApprovalForm({ requestId, itemId, label }: { requestId: string; itemId: string; label?: string }) {
  const [state, formAction, pending] = useActionState(approveVendorCommercialItemAction, INITIAL_STATE)
  const [revisionState, revisionAction, revisionPending] = useActionState(requestVendorCommercialRevisionAction, INITIAL_STATE)

  return (
    <div className="stack" style={{ gap: 10 }}>
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="itemId" value={itemId} />
      <ActionFeedback error={state.error} success={state.success ? state.message ?? 'Approved.' : null} />
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Approving...' : (label ?? 'Approve')}
      </button>
    </form>
    <details className="advancedDisclosure">
      <summary>Request changes or counter</summary>
      <form action={revisionAction} className="stack" style={{ gap: 8, paddingTop: 10 }}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="itemId" value={itemId} />
        <label className="field">
          <span className="field-label">Counter amount (optional)</span>
          <input className="input" name="counterAmount" type="number" min="0" step="0.01" inputMode="decimal" />
        </label>
        <label className="field">
          <span className="field-label">What should change?</span>
          <textarea className="input" name="note" rows={3} required />
        </label>
        <ActionFeedback error={revisionState.error} success={revisionState.success ? revisionState.message : null} />
        <button type="submit" className="button" disabled={revisionPending}>{revisionPending ? 'Sending...' : 'Send counter to vendor'}</button>
      </form>
    </details>
    </div>
  )
}
