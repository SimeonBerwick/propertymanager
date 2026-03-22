'use client'

import { useActionState } from 'react'
import { login } from '@/lib/auth-actions'
import type { LoginState } from '@/lib/auth-actions'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(login, null)

  return (
    <form action={formAction} className="stack">
      {state?.error && (
        <div style={{ color: 'var(--danger)', fontSize: 14 }}>{state.error}</div>
      )}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Password</span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          style={{
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
          }}
        />
      </label>
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
