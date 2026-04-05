'use client'

import { useActionState } from 'react'
import { sendExceptionSummaryNow, type ExceptionActionState } from './actions'

const INITIAL_STATE: ExceptionActionState = { error: null }

export function SendSummaryForm() {
  const [state, action, pending] = useActionState(sendExceptionSummaryNow, INITIAL_STATE)

  return (
    <form action={action} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Sending…' : 'Send daily summary now'}
      </button>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Summary sent.</div> : null}
    </form>
  )
}
