'use client'

import { useActionState } from 'react'
import { startReturningLoginAction, type ReturningLoginState } from './actions'

const INITIAL_STATE: ReturningLoginState = { error: null }

export function ReturningLoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(startReturningLoginAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="next" value={next ?? ''} />
      {state.error && <div className="notice error">{state.error}</div>}
      <label className="field">
        <span className="field-label">Email or phone number</span>
        <input className="input" type="text" name="identifier" autoComplete="username" placeholder="tenant@example.com or +16025551212" required />
      </label>
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Sending secure link...' : 'Send secure sign-in link'}
      </button>
      <div className="muted">Open the link in the message for one-tap access, or enter the included code. This device stays signed in for up to one year.</div>
    </form>
  )
}
