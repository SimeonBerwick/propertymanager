'use client'

import { useActionState, useState } from 'react'
import { startReturningLoginAction, type ReturningLoginState } from './actions'

const INITIAL_STATE: ReturningLoginState = { error: null }

export function ReturningLoginForm({ next }: { next?: string }) {
  const [identifier, setIdentifier] = useState('')
  const [state, formAction, isPending] = useActionState(startReturningLoginAction, INITIAL_STATE)
  const isAccessCode = /^\d{6}$/.test(identifier.trim())

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="next" value={next ?? ''} />
      {state.error && <div className="notice error">{state.error}</div>}
      <label className="field">
        <span className="field-label">Email, phone, or access code</span>
        <input className="input" type="text" name="identifier" autoComplete="username" placeholder="Email, phone number, or 6-digit code" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
      </label>
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Checking access...' : isAccessCode ? 'Use access code' : 'Send secure sign-in link'}
      </button>
      <div className="muted">We automatically detect the access method. Secure links and sign-in codes are sent when you enter email or phone.</div>
    </form>
  )
}
