'use client'

import { useActionState } from 'react'
import { runAutomationNow, sendExceptionSummaryNow, type ExceptionActionState } from './actions'

const INITIAL_STATE: ExceptionActionState = { error: null }

export function SendSummaryForm() {
  const [runState, runAction, runPending] = useActionState(runAutomationNow, INITIAL_STATE)
  const [state, action, pending] = useActionState(sendExceptionSummaryNow, INITIAL_STATE)

  return (
    <div className="stack" style={{ gap: 8 }}>
      <form action={runAction} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
        <button type="submit" className="button" disabled={runPending}>
          {runPending ? 'Running…' : 'Run automation sweep now'}
        </button>
        {runState.error ? <div className="notice error">{runState.error}</div> : null}
        {runState.success ? <div className="notice success">Automation sweep finished.</div> : null}
      </form>
      <form action={action} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Sending…' : 'Send daily summary now'}
        </button>
        {state.error ? <div className="notice error">{state.error}</div> : null}
        {state.success ? <div className="notice success">Summary sent.</div> : null}
      </form>
    </div>
  )
}
