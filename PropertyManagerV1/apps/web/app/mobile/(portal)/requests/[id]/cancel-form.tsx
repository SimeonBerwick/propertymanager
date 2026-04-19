'use client'

import { useActionState } from 'react'
import { cancelTenantMobileRequestAction, type TenantRequestActionState } from './actions'

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
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Request canceled.</div> : null}
      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Canceling…' : 'Cancel request'}
      </button>
    </form>
  )
}
