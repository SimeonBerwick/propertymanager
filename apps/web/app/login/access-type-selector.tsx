'use client'

import { useState } from 'react'
import { LoginForm } from './login-form'
import { VendorLoginForm } from '@/app/vendor/auth/login/form'
import { ReturningLoginForm } from '@/app/mobile/auth/login/form'

type Role = 'manager' | 'vendor' | 'tenant'

export function AccessTypeSelector({ error }: { error?: string }) {
  const [selectedRole, setSelectedRole] = useState<Role>('manager')

  return (
    <div className="authRoleGrid">
      <div className={selectedRole === 'manager' ? 'authRoleCard authRoleCardActive' : 'authRoleCard'}>
        <div className="kicker">Property manager</div>
        <h3 style={{ margin: '4px 0 0' }}>Manage the portfolio</h3>
        {selectedRole === 'manager' ? (
          <>
            <div className="authRoleBadge">Property manager</div>
            <LoginForm error={error} />
          </>
        ) : (
          <button type="button" className="button" onClick={() => setSelectedRole('manager')}>
            Property manager sign in
          </button>
        )}
      </div>

      <div className={selectedRole === 'vendor' ? 'authRoleCard authRoleCardActive' : 'authRoleCard'}>
        <div className="kicker">Vendor</div>
        <h3 style={{ margin: '4px 0 0' }}>Open vendor portal</h3>
        {selectedRole === 'vendor' ? (
          <>
            <div className="authRoleBadge">Vendor</div>
            <VendorLoginForm />
          </>
        ) : (
          <button type="button" className="button" onClick={() => setSelectedRole('vendor')}>
            Vendor sign in
          </button>
        )}
      </div>

      <div className={selectedRole === 'tenant' ? 'authRoleCard authRoleCardActive' : 'authRoleCard'}>
        <div className="kicker">Tenant</div>
        <h3 style={{ margin: '4px 0 0' }}>Open tenant portal</h3>
        {selectedRole === 'tenant' ? (
          <>
            <div className="authRoleBadge">Tenant</div>
            <ReturningLoginForm />
          </>
        ) : (
          <button type="button" className="button" onClick={() => setSelectedRole('tenant')}>
            Tenant sign in
          </button>
        )}
      </div>
    </div>
  )
}
