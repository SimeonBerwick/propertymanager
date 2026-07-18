'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ActionFeedback } from '@/components/action-feedback'
import { continueAfterBoardApprovalAction, resendBoardApprovalAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

export function BoardDecisionPanel({ requestId, decision, approverName, note }: { requestId: string; decision: 'approved' | 'returned' | 'declined'; approverName: string; note?: string | null }) {
  const router = useRouter()
  const [continueState, continueAction, continuePending] = useActionState(continueAfterBoardApprovalAction, INITIAL_STATE)
  const [resendState, resendAction, resendPending] = useActionState(resendBoardApprovalAction, INITIAL_STATE)
  useEffect(() => {
    if (continueState.success || resendState.success) router.refresh()
  }, [continueState.success, resendState.success, router])

  if (decision === 'approved') {
    return <div className="notice stack" style={{ gap: 10 }}>
      <div><strong>Board approved this request.</strong><div className="muted">Decision recorded by {approverName}. Confirm the work order and move directly to vendor assignment.</div></div>
      {note ? <div className="inlineNotice">Board note: {note}</div> : null}
      <form action={continueAction} className="stack" style={{ gap: 10 }}>
        <input type="hidden" name="requestId" value={requestId} />
        <ActionFeedback error={continueState.error} success={continueState.success ? 'Request approved. Choose the vendor path below.' : null} />
        <button type="submit" className="button primary" disabled={continuePending}>{continuePending ? 'Continuing...' : 'Continue to vendor assignment'}</button>
      </form>
    </div>
  }

  return <div className="notice stack" style={{ gap: 10 }}>
    <div><strong>Board {decision === 'returned' ? 'returned this request with a question.' : 'declined this request.'}</strong><div className="muted">Decision recorded by {approverName}. Update the work order if needed, then resend it for a fresh board decision.</div></div>
    {note ? <div className="inlineNotice">Board note: {note}</div> : null}
    <form action={resendAction} className="stack" style={{ gap: 10 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field"><span className="field-label">What changed for the board?</span><textarea className="input textarea" name="note" rows={3} maxLength={1000} required placeholder="Example: Revised scope and vendor estimate added." /></label>
      <ActionFeedback error={resendState.error} success={resendState.success ? resendState.message : null} />
      <button type="submit" className="button primary" disabled={resendPending}>{resendPending ? 'Resending...' : 'Resend board approval request'}</button>
    </form>
  </div>
}
