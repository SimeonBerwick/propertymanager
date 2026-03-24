'use client'

import { useActionState } from 'react'
import { verifyReturningLoginAction, type ReturningVerifyState } from './actions'

const INITIAL_STATE: ReturningVerifyState = { error: null }

export function ReturningLoginVerifyForm({ challengeId }: { challengeId: string }) {
  const [state, formAction, isPending] = useActionState(verifyReturningLoginAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="challengeId" value={challengeId} />
      {state.error && <div className="notice error">{state.error}</div>}
      <label className="field">
        <span className="field-label">Verification code</span>
        <input className="input" type="text" name="code" inputMode="numeric" maxLength={6} placeholder="123456" required />
      </label>
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Verifying…' : 'Verify and sign in'}
      </button>
    </form>
  )
}
