'use client'

import { useActionState } from 'react'
import { login } from '@/lib/auth-actions'
import type { LoginState } from '@/lib/auth-actions'

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(login, null)

  return (
    <form action={formAction} className="stack">
      {state?.error && <div className="notice error">{state.error}</div>}

      <label className="field">
        <span className="field-label">Email</span>
        <input
          className="input"
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="landlord@example.com"
        />
      </label>

      <label className="field">
        <span className="field-label">Password</span>
        <input
          className="input"
          type="password"
          name="password"
          required
          autoComplete="current-password"
        />
      </label>

      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
