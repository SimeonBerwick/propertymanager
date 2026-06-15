'use client'

import { useActionState } from 'react'
import { sendExceptionSummaryNow, type ExceptionActionState } from './actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: ExceptionActionState = { error: null }

export function SendSummaryForm() {
  const [state, action, pending] = useActionState(sendExceptionSummaryNow, INITIAL_STATE)

  return (
    <div className="stack" style={{ gap: 8 }}>
      <form action={action} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Sending…' : 'Send daily summary now'}
        </button>
      </form>
      <ActionFeedback error={state.error} success={state.success && 'Summary sent.'} />
    </div>
  )
}
