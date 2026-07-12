'use client'

import { LoginForm } from './login-form'

export function AccessTypeSelector({ error, mode = 'choose' }: { error?: string; mode?: 'choose' | 'manager' }) {
  if (mode === 'manager') {
    return (
      <div className="stack" style={{ gap: 14 }}>
        <LoginForm error={error} />
        <a href="/login?role=choose" className="button" style={{ alignSelf: 'flex-start' }}>Choose a different sign-in</a>
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {error ? <div className="notice error">{error}</div> : null}
      <div className="muted">Choose the role you want to use right now.</div>
      <div className="authRoleTabs" aria-label="Access type">
        <a href="/login?role=manager" className="authRoleTab authRoleLink">Property manager</a>
        <a href="/mobile/auth/login" className="authRoleTab authRoleLink">Tenant</a>
        <a href="/vendor/auth/login" className="authRoleTab authRoleLink">Vendor</a>
      </div>
    </div>
  )
}
