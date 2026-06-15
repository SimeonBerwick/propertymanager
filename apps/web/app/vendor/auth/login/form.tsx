'use client'

import { useActionState, useState } from 'react'
import { startVendorDevLoginAction, startVendorLoginAction, type VendorReturningLoginState } from './actions'

const INITIAL_STATE: VendorReturningLoginState = { error: null }

export function VendorLoginForm({ defaultEmail, next }: { defaultEmail?: string; next?: string }) {
  const [identifier, setIdentifier] = useState(defaultEmail ?? '')
  const [state, formAction, isPending] = useActionState(startVendorLoginAction, INITIAL_STATE)
  const isAccessCode = /^\d{6}$/.test(identifier.trim())

  return (
    <div className="stack">
      <form action={formAction} className="stack">
        <input type="hidden" name="next" value={next ?? ''} />
        {state.error && <div className="notice error">{state.error}</div>}
        <label className="field">
          <span className="field-label">Email, phone, or access code</span>
          <input
            className="input"
            type="text"
            name="identifier"
            autoComplete="username"
            placeholder="Email, phone number, or 6-digit code"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
        </label>
        <div className="stack" style={{ gap: 8 }}>
          <button type="submit" className="button primary" disabled={isPending}>
            {isPending ? 'Checking access...' : isAccessCode ? 'Use access code' : 'Send secure sign-in link'}
          </button>
          <div className="muted">We automatically detect the access method. Secure links and sign-in codes are sent when you enter email or phone.</div>
        </div>
      </form>
      {process.env.NODE_ENV !== 'production' ? (
        <form action={startVendorDevLoginAction} className="stack" style={{ gap: 8 }}>
          <input type="hidden" name="next" value={next ?? ''} />
          <input type="hidden" name="identifier" value={identifier} />
          <button type="submit" className="button">
            Dev sign in directly
          </button>
        </form>
      ) : null}
    </div>
  )
}
