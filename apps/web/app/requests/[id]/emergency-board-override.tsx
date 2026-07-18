'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ActionFeedback } from '@/components/action-feedback'
import { emergencyBoardOverrideAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

export function EmergencyBoardOverride({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(emergencyBoardOverrideAction, INITIAL_STATE)
  useEffect(() => { if (state.success) router.refresh() }, [router, state.success])

  return <details className="advancedDisclosure">
    <summary>Emergency override</summary>
    <form action={action} className="stack" style={{ gap: 10, padding: 16 }}>
      <div><strong>Approve work now and notify the board</strong><div className="muted">Use only when waiting for the board would create an unacceptable safety, property, or operational risk. The board receives your reason immediately; tenants do not receive board notes.</div></div>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field"><span className="field-label">Emergency decision and reason</span><textarea className="input textarea" name="note" rows={3} maxLength={1000} required placeholder="Example: Active water leak requires immediate mitigation to prevent further damage." /></label>
      <ActionFeedback error={state.error} success={state.success ? state.message : null} />
      <button type="submit" className="button" disabled={pending}>{pending ? 'Recording...' : 'Approve work and notify board'}</button>
    </form>
  </details>
}
