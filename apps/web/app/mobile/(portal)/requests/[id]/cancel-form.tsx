'use client'

import { useActionState } from 'react'
import { cancelTenantMobileRequestAction, type TenantRequestActionState } from './actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: TenantRequestActionState = { error: null }

export function TenantRequestCancelForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(cancelTenantMobileRequestAction, INITIAL_STATE)

  return (
    <form action={action} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span className="field-label">Cancel reason</span>
        <textarea className="input" name="reason" rows={3} placeholder="Why are you canceling this request?" />
      </label>
      <ActionFeedback error={state.error} success={state.success && 'Request canceled.'} />
      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Canceling…' : 'Cancel request'}
      </button>
    </form>
  )
}
