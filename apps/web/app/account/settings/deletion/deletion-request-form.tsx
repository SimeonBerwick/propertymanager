'use client'

import { useActionState } from 'react'
import { requestAccountDeletionAction, type DeletionRequestState } from './actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: DeletionRequestState = { error: null, success: null }

export function DeletionRequestForm() {
  const [state, action, pending] = useActionState(requestAccountDeletionAction, INITIAL_STATE)

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <ActionFeedback error={state.error} success={state.success} />

      <label className="field">
        <span className="field-label">Reason or additional details</span>
        <textarea className="input" name="reason" maxLength={1000} rows={5} placeholder="Optional" />
      </label>

      <label className="row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" name="confirm" value="yes" required />
        <span>I understand this requests deletion of my account and associated personal data.</span>
      </label>

      <label className="row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" name="subscriptionConfirm" value="yes" required />
        <span>
          I understand that if I have a paid subscription, this request also asks Simeonware to cancel future access and renewal. If I paid annually, I will not receive a prorated refund for unused time, and I still want to proceed.
        </span>
      </label>

      <button type="submit" className="button primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? 'Submitting request...' : 'Request account deletion'}
      </button>
    </form>
  )
}
