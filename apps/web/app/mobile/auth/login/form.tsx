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
        <span className="field-label">Email, phone, or sign-in code</span>
        <input className="input" type="text" name="identifier" autoComplete="username" placeholder="Email, phone number, or 6-digit code" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
      </label>
      <button type="submit" className="button primary" aria-disabled={isPending}>
        {isPending ? 'Signing in...' : isAccessCode ? 'Use sign-in code' : 'Sign in'}
      </button>
      <div className="muted">Use the one-time code from your property manager the first time. After that, your email or phone number signs you in on this device.</div>
    </form>
  )
}
