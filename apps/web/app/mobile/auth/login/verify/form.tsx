'use client'

import { useActionState } from 'react'
import { verifyReturningLoginAction, type ReturningVerifyState } from './actions'
import { OtpCodeField } from '@/components/otp-code-field'

const INITIAL_STATE: ReturningVerifyState = { error: null }

export function ReturningLoginVerifyForm({ challengeId, next }: { challengeId: string; next?: string }) {
  const [state, formAction, isPending] = useActionState(verifyReturningLoginAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="next" value={next ?? ''} />
      {state.error && <div className="notice error">{state.error}</div>}
      <OtpCodeField />
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Verifying…' : 'Verify and sign in'}
      </button>
    </form>
  )
}
