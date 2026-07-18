'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ActionFeedback } from '@/components/action-feedback'
import { resendBoardApprovalAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

export function BoardPendingPanel({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(resendBoardApprovalAction, INITIAL_STATE)
  useEffect(() => { if (state.success) router.refresh() }, [router, state.success])

  return <div className="notice stack" style={{ gap: 10 }}>
    <div><strong>Waiting for board approval.</strong><div className="muted">The work order stays paused until a board member responds.</div></div>
    <details className="advancedDisclosure">
      <summary>Board member needs a fresh link</summary>
      <form action={action} className="stack" style={{ gap: 10, padding: 16 }}>
        <div className="muted">This invalidates the earlier link and emails a new secure approval link to the current approver list.</div>
        <input type="hidden" name="requestId" value={requestId} />
        <label className="field"><span className="field-label">Why are you resending it?</span><textarea className="input textarea" name="note" rows={2} maxLength={1000} required placeholder="Example: Board member reports that the original link expired." /></label>
        <ActionFeedback error={state.error} success={state.success ? state.message : null} />
        <button type="submit" className="button" disabled={pending}>{pending ? 'Sending...' : 'Send fresh board link'}</button>
      </form>
    </details>
  </div>
}
