'use client'

import { useActionState } from 'react'
import { startReturningLoginAction, type ReturningLoginState } from './actions'

const INITIAL_STATE: ReturningLoginState = { error: null }

export function ReturningLoginForm() {
  const [state, formAction, isPending] = useActionState(startReturningLoginAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="notice error">{state.error}</div>}
      <label className="field">
        <span className="field-label">Email</span>
        <input className="input" type="email" name="identifier" placeholder="tenant@example.com" required />
      </label>
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Sending code…' : 'Email me a sign-in code'}
      </button>
      <div className="muted">The code expires after 10 minutes. After verification, this device stays signed in for up to one year or until you sign out.</div>
    </form>
  )
}
