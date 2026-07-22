'use client'

import { LoginForm } from './login-form'
import { AuthNavigationLinks } from '@/components/auth-navigation-links'

export function AccessTypeSelector({ error, mode = 'choose' }: { error?: string; mode?: 'choose' | 'manager' }) {
  if (mode === 'manager') {
    return (
      <div className="stack" style={{ gap: 14 }}>
        <AuthNavigationLinks />
        <LoginForm error={error} />
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
        <a href="/maintenance/auth/login" className="authRoleTab authRoleLink">Maintenance staff</a>
        <a href="/vendor/auth/login" className="authRoleTab authRoleLink">Vendor</a>
      </div>
      <AuthNavigationLinks showRoleChoice={false} />
    </div>
  )
}
