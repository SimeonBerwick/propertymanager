'use client'

import { useFormStatus } from 'react-dom'
import { loginRouteAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className="button primary" aria-disabled={pending}>
      {pending ? 'Signing in...' : 'Sign in'}
    </button>
  )
}

export function LoginForm({ error }: { error?: string }) {
  const showHelp = Boolean(error)
  const isCredentialError = Boolean(error)
    && !error?.includes('link needs sign-in')
    && !error?.includes('session expired')

  return (
    <form action={loginRouteAction} className="stack">
      {error ? (
        <div className="notice error stack" style={{ gap: 8 }}>
          <span>{error}</span>
          {isCredentialError ? <span>Check the email and password, or contact support if you need your password reset.</span> : null}
        </div>
      ) : null}

      <label className="field">
        <span className="field-label">Email</span>
        <input
          className="input"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="manager@example.com"
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
      {showHelp ? (
        <a className="button" href="mailto:support@simeonware.com?subject=Password%20reset%20help">
          Get sign-in help
        </a>
      ) : null}
    </form>
  )
}
