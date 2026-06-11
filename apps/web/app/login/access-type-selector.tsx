'use client'

import { useState } from 'react'
import { LoginForm } from './login-form'
import { VendorLoginForm } from '@/app/vendor/auth/login/form'
import { ReturningLoginForm } from '@/app/mobile/auth/login/form'

type Role = 'manager' | 'vendor' | 'tenant'

export function AccessTypeSelector({ error }: { error?: string }) {
  const [selectedRole, setSelectedRole] = useState<Role>('manager')

  const tabClass = (role: Role) => selectedRole === role ? 'authRoleTab authRoleTabActive' : 'authRoleTab'

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="authRoleTabs" role="tablist" aria-label="Access type">
        <button type="button" className={tabClass('manager')} onClick={() => setSelectedRole('manager')}>
          Property manager
        </button>
        <button type="button" className={tabClass('vendor')} onClick={() => setSelectedRole('vendor')}>
          Vendor
        </button>
        <button type="button" className={tabClass('tenant')} onClick={() => setSelectedRole('tenant')}>
          Tenant
        </button>
      </div>

      <div className="authRolePanel">
        {selectedRole === 'manager' ? (
          <>
            <div className="notice trialNotice">
              <div>
                <strong>Try the complete workflow free for 31 days.</strong>
                <div className="muted">No credit card required during signup.</div>
              </div>
              <a href="/signup" className="button primary">Start free trial</a>
            </div>
            <LoginForm error={error} />
          </>
        ) : null}

        {selectedRole === 'vendor' ? <VendorLoginForm /> : null}

        {selectedRole === 'tenant' ? <ReturningLoginForm /> : null}
      </div>
    </div>
  )
}
