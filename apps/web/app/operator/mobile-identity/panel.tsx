'use client'

import { useActionState, useState } from 'react'
import {
  deactivateMobileIdentityAction,
  sendMobileInviteAction,
  setupMobileIdentityAction,
  type MobileIdentityState,
} from './actions'
import { getTenantLeaseLabel } from '@/lib/tenant-occupancy'
import { ManagerAccessCodeForm } from '@/components/manager-access-code-form'
import { formatDateOnly, formatDateTime } from '@/lib/ui-utils'

const INITIAL_STATE: MobileIdentityState = { error: null }

function tenantSignInStatus(status: string) {
  if (status === 'pending_invite') return 'Access not yet activated'
  if (status === 'active') return 'Signed in'
  if (status === 'inactive') return 'Inactive'
  if (status === 'moved_out') return 'Moved out'
  return status.replaceAll('_', ' ')
}

interface MobileIdentityPanelProps {
  unitId: string
  unitIsActive?: boolean
  propertyIsActive?: boolean
  tenantName?: string
  tenantEmail?: string
  tenantIdentities?: Array<{
    id: string
    tenantName: string
    phoneE164: string
    email?: string | null
    status: string
    leaseStartDate?: string | null
    leaseEndDate?: string | null
    verifiedAt?: string | null
    lastLoginAt?: string | null
  }>
}

export function MobileIdentityPanel({ unitId, unitIsActive = true, propertyIsActive = true, tenantName, tenantEmail, tenantIdentities = [] }: MobileIdentityPanelProps) {
  const [setupState, setupAction, setupPending] = useActionState(setupMobileIdentityAction, INITIAL_STATE)
  const [inviteState, inviteAction, invitePending] = useActionState(sendMobileInviteAction, INITIAL_STATE)
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(deactivateMobileIdentityAction, INITIAL_STATE)

  const isArchived = !unitIsActive || !propertyIsActive
  const now = new Date()
  const sorted = [...tenantIdentities].sort((a, b) => new Date(a.leaseStartDate ?? 0).getTime() - new Date(b.leaseStartDate ?? 0).getTime())
  const currentIdentity = [...sorted].reverse().find((identity) => {
    const start = identity.leaseStartDate ? new Date(identity.leaseStartDate) : new Date(0)
    const end = identity.leaseEndDate ? new Date(identity.leaseEndDate) : null
    return identity.status !== 'inactive' && identity.status !== 'moved_out' && start <= now && (!end || end >= now)
  }) ?? null
  const upcomingIdentity = sorted.find((identity) => {
    const start = identity.leaseStartDate ? new Date(identity.leaseStartDate) : new Date(0)
    return identity.status !== 'inactive' && identity.status !== 'moved_out' && start > now
  }) ?? null
  const [currentMonthToMonth, setCurrentMonthToMonth] = useState(!currentIdentity?.leaseEndDate)
  const [upcomingMonthToMonth, setUpcomingMonthToMonth] = useState(!upcomingIdentity?.leaseEndDate)

  return (
    <section className="card stack">
      <div>
        <div className="kicker">Tenant sign-in</div>
        <h3 style={{ marginTop: 4 }}>Tenant details and sign-in code</h3>
        <div className="muted">A sign-in code lets the tenant open their tenant view. It does not approve work, pricing, or billing.</div>
      </div>

      {currentIdentity ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="kicker">Current tenant</div>
          <div className="muted">Sign-in status: {tenantSignInStatus(currentIdentity.status)}</div>
          <div className="muted">Tenant: {currentIdentity.tenantName}</div>
          <div className="muted">Lease: {getTenantLeaseLabel(currentIdentity)}</div>
          <div className="muted">Phone: {currentIdentity.phoneE164}</div>
          {currentIdentity.email && <div className="muted">Email: {currentIdentity.email}</div>}
          <div className="muted">Verified: {currentIdentity.verifiedAt ? formatDateTime(currentIdentity.verifiedAt) : 'No'}</div>
          <div className="muted">Last login: {currentIdentity.lastLoginAt ? formatDateTime(currentIdentity.lastLoginAt) : 'Never'}</div>
        </div>
      ) : (
        <div className="notice" style={{ background: '#fff8e1', borderColor: '#fcd34d' }}>
          This unit is currently vacant.
          {upcomingIdentity?.leaseStartDate ? ` Next tenant starts ${formatDateOnly(upcomingIdentity.leaseStartDate)}.` : ''}
        </div>
      )}

      {upcomingIdentity ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="kicker">Upcoming tenant</div>
          <div className="muted">Tenant: {upcomingIdentity.tenantName}</div>
          <div className="muted">Lease: {getTenantLeaseLabel(upcomingIdentity)}</div>
          <div className="muted">Phone: {upcomingIdentity.phoneE164}</div>
          {upcomingIdentity.email && <div className="muted">Email: {upcomingIdentity.email}</div>}
        </div>
      ) : null}

      {isArchived && (
        <div className="notice" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
          This unit is archived. Tenant sign-in setup and code delivery are disabled until the property and unit are restored.
        </div>
      )}

      {setupState.error && <div className="notice error">{setupState.error}</div>}
      {setupState.success && <div className="notice success">Tenant details saved.</div>}
      {inviteState.error && <div className="notice error">{inviteState.error}</div>}
      {deactivateState.error && <div className="notice error">{deactivateState.error}</div>}
      {inviteState.inviteLink && (
        <div className="notice" style={{ background: '#f5fff7', borderColor: '#b7ebc6' }}>
          Sign-in link: <a href={inviteState.inviteLink}>{inviteState.inviteLink}</a>
        </div>
      )}
      {inviteState.deliveryWarning && (
        <div className="notice" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
          {inviteState.deliveryWarning}
        </div>
      )}

      <form action={setupAction} className="stack">
        <input type="hidden" name="unitId" value={unitId} />
        {currentIdentity ? <input type="hidden" name="tenantIdentityId" value={currentIdentity.id} /> : null}
        <label className="field">
          <span className="field-label">Current tenant name</span>
          <input className="input" type="text" name="tenantName" defaultValue={currentIdentity?.tenantName ?? tenantName ?? ''} required />
        </label>
        <label className="field">
          <span className="field-label">Phone number</span>
          <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
            <select className="input" name="phoneRegion" defaultValue="US" style={{ width: 'auto', flexShrink: 0 }} aria-label="Phone region">
              <option value="US">US (+1)</option>
              <option value="CA">CA (+1)</option>
              <option value="GB">GB (+44)</option>
              <option value="AU">AU (+61)</option>
              <option value="MX">MX (+52)</option>
              <option value="DE">DE (+49)</option>
              <option value="FR">FR (+33)</option>
              <option value="IN">IN (+91)</option>
              <option value="NZ">NZ (+64)</option>
              <option value="ZA">ZA (+27)</option>
            </select>
            <input className="input" type="text" name="phoneE164" defaultValue={currentIdentity?.phoneE164 ?? ''} placeholder="+16025551212 or local format" required style={{ flex: 1 }} />
          </div>
          <span className="field-hint" style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Use E.164 (+16025551212) for any region, or local format with the correct region selected.
          </span>
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" name="email" defaultValue={currentIdentity?.email ?? tenantEmail ?? ''} placeholder="tenant@example.com" />
        </label>
        <div className="grid cols-2">
          <label className="field">
            <span className="field-label">Lease start</span>
            <input className="input" type="date" name="leaseStartDate" defaultValue={currentIdentity?.leaseStartDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} required />
          </label>
          <label className="field">
            <span className="field-label">Lease end</span>
            <input
              className="input"
              type="date"
              name="leaseEndDate"
              defaultValue={currentIdentity?.leaseEndDate?.slice(0, 10) ?? ''}
              disabled={currentMonthToMonth}
              style={currentMonthToMonth ? { opacity: 0.45 } : undefined}
            />
          </label>
        </div>
        <label className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
          <input
            type="checkbox"
            name="monthToMonth"
            checked={currentMonthToMonth}
            onChange={(event) => setCurrentMonthToMonth(event.target.checked)}
          />
          <span>Month to month</span>
        </label>
        <button type="submit" className="button" disabled={setupPending || isArchived}>{setupPending ? 'Saving...' : 'Save current tenant'}</button>
      </form>

      <form action={setupAction} className="stack">
        <input type="hidden" name="unitId" value={unitId} />
        <input type="hidden" name="createMode" value="future" />
        {upcomingIdentity ? <input type="hidden" name="tenantIdentityId" value={upcomingIdentity.id} /> : null}
        <div>
          <div className="kicker">Next tenant</div>
          <h4 style={{ margin: '4px 0 0' }}>Stage upcoming occupancy</h4>
          <div className="muted">Optional. Leave this blank if the unit will be vacant after the current lease ends.</div>
        </div>
        <label className="field">
          <span className="field-label">Next tenant name</span>
          <input className="input" type="text" name="tenantName" defaultValue={upcomingIdentity?.tenantName ?? ''} />
        </label>
        <label className="field">
          <span className="field-label">Phone number</span>
          <input className="input" type="text" name="phoneE164" defaultValue={upcomingIdentity?.phoneE164 ?? ''} placeholder="+16025551212" />
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" name="email" defaultValue={upcomingIdentity?.email ?? ''} placeholder="next-tenant@example.com" />
        </label>
        <div className="grid cols-2">
          <label className="field">
            <span className="field-label">Lease start</span>
            <input className="input" type="date" name="leaseStartDate" defaultValue={upcomingIdentity?.leaseStartDate?.slice(0, 10) ?? ''} />
          </label>
          <label className="field">
            <span className="field-label">Lease end</span>
            <input
              className="input"
              type="date"
              name="leaseEndDate"
              defaultValue={upcomingIdentity?.leaseEndDate?.slice(0, 10) ?? ''}
              disabled={upcomingMonthToMonth}
              style={upcomingMonthToMonth ? { opacity: 0.45 } : undefined}
            />
          </label>
        </div>
        <label className="row" style={{ justifyContent: 'flex-start', gap: 10 }}>
          <input
            type="checkbox"
            name="monthToMonth"
            checked={upcomingMonthToMonth}
            onChange={(event) => setUpcomingMonthToMonth(event.target.checked)}
          />
          <span>Month to month</span>
        </label>
        <button type="submit" className="button" disabled={setupPending || isArchived}>{setupPending ? 'Saving...' : 'Save next tenant'}</button>
      </form>

      {currentIdentity && (
        <section className="card stack">
          <div>
            <div className="kicker">Access recovery</div>
            <h4 style={{ margin: '4px 0 0' }}>Correct details and send sign-in code</h4>
            <div className="muted">If the tenant changed their email or phone, update and save the current tenant above, then send a new sign-in code below.</div>
          </div>
          <ManagerAccessCodeForm
            role="tenant"
            recipientId={currentIdentity.id}
            recipientName={currentIdentity.tenantName}
            disabled={isArchived}
          />
        </section>
      )}

      {currentIdentity && (
        <div className="row" style={{ justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <form action={inviteAction}>
            <input type="hidden" name="tenantIdentityId" value={currentIdentity.id} />
            <button type="submit" className="button primary" disabled={invitePending || isArchived}>
              {invitePending ? 'Emailing link...' : 'Email tenant sign-in link'}
            </button>
          </form>
          <form action={deactivateAction}>
            <input type="hidden" name="tenantIdentityId" value={currentIdentity.id} />
            <button type="submit" className="button" disabled={deactivatePending}>
              {deactivatePending ? 'Deactivating...' : 'Deactivate tenant sign-in'}
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
