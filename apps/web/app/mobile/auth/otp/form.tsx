'use client'

import { useActionState } from 'react'
import { verifyTenantOtpAction, type OtpState } from './actions'

const INITIAL_STATE: OtpState = { error: null }

export function TenantOtpForm({ challengeId, inviteId }: { challengeId: string; inviteId: string }) {
  const [state, formAction, isPending] = useActionState(verifyTenantOtpAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="inviteId" value={inviteId} />
      {state.error && <div className="notice error">{state.error}</div>}
      <label className="field">
        <span className="field-label">Verification code</span>
        <input className="input" type="text" name="code" inputMode="numeric" maxLength={6} placeholder="123456" required />
      </label>
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Verifying…' : 'Verify code'}
      </button>
    </form>
  )
}
