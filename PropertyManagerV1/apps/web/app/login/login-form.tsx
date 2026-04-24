'use client'

import { useFormStatus } from 'react-dom'
import { loginRouteAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className="button primary" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  )
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={loginRouteAction} className="stack">
      {error ? <div className="notice error">{error}</div> : null}

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

      <SubmitButton />
    </form>
  )
}
