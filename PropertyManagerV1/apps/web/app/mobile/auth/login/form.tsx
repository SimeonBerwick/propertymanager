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
        <span className="field-label">Phone or email</span>
        <input className="input" type="text" name="identifier" placeholder="+16025551212 or tenant@example.com" required />
      </label>
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Sending code…' : 'Send login code'}
      </button>
    </form>
  )
}
