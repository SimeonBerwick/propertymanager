'use client'

import { useActionState } from 'react'
import { ActionFeedback } from '@/components/action-feedback'
import { sendTenantWorkOrderMessageAction, type TenantRequestActionState } from './actions'

const INITIAL_STATE: TenantRequestActionState = { error: null }

export function TenantWorkOrderMessageForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(sendTenantWorkOrderMessageAction, INITIAL_STATE)

  return (
    <form action={action} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span className="field-label">Message</span>
        <textarea className="input" name="body" rows={4} placeholder="Ask for a different appointment time or tell us about an issue with this repair." required />
      </label>
      <ActionFeedback error={state.error} success={state.success && 'Message sent.'} />
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Sending...' : 'Send message'}
      </button>
    </form>
  )
}
