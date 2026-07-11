'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { dismissTenantQuestionAction, type RequestActionState } from '@/lib/request-detail-actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: RequestActionState = { error: null }

export function NoReplyNeededForm({ requestId, isTimeSensitive }: { requestId: string, isTimeSensitive: boolean }) {
  const [state, action, pending] = useActionState(dismissTenantQuestionAction, INITIAL_STATE)
  const router = useRouter()

  useEffect(() => {
    if (!state.success) return
    router.replace(`/requests/${requestId}` as Route, { scroll: false })
    router.refresh()
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }, [requestId, router, state.success])

  return (
    <details className="advancedDisclosure">
      <summary>No reply needed</summary>
      <form action={action} className="stack" style={{ gap: 8, marginTop: 10 }}>
        <input type="hidden" name="requestId" value={requestId} />
        {isTimeSensitive ? <div className="notice">This message mentions timing or urgency. Confirm that no tenant reply is needed before clearing it.</div> : null}
        <label className="field">
          <span className="field-label">Internal reason, optional</span>
          <input className="input" name="reason" maxLength={300} placeholder="For example: Information only; no response requested" />
        </label>
        <button type="submit" className="button" disabled={pending}>{pending ? 'Clearing...' : 'Mark no reply needed'}</button>
        <ActionFeedback error={state.error} success={state.success && 'Tenant question cleared. No message was sent.'} />
      </form>
    </details>
  )
}
