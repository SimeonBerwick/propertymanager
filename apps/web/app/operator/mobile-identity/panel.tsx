'use client'

import { useActionState } from 'react'
import {
  deactivateMobileIdentityAction,
  sendMobileInviteAction,
  setupMobileIdentityAction,
  type MobileIdentityState,
} from './actions'

const INITIAL_STATE: MobileIdentityState = { error: null }

interface MobileIdentityPanelProps {
  unitId: string
  unitIsActive?: boolean
  propertyIsActive?: boolean
  tenantName?: string
  tenantEmail?: string
  tenantIdentity?: {
    id: string
    tenantName: string
    phoneE164: string
    email?: string | null
    status: string
    verifiedAt?: string | null
    lastLoginAt?: string | null
    issues?: string[]
  } | null
}

export function MobileIdentityPanel({ unitId, unitIsActive = true, propertyIsActive = true, tenantName, tenantEmail, tenantIdentity }: MobileIdentityPanelProps) {
  const [setupState, setupAction, setupPending] = useActionState(setupMobileIdentityAction, INITIAL_STATE)
  const [inviteState, inviteAction, invitePending] = useActionState(sendMobileInviteAction, INITIAL_STATE)
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(deactivateMobileIdentityAction, INITIAL_STATE)

  const isArchived = !unitIsActive || !propertyIsActive

  return (
    <section className="card stack">
      <div>
        <div className="kicker">Mobile tenant access</div>
        <h3 style={{ marginTop: 4 }}>Invite and manage tenant portal access</h3>
      </div>

      {tenantIdentity ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="muted">Status: {tenantIdentity.status}</div>
          <div className="muted">Tenant: {tenantIdentity.tenantName}</div>
          <div className="muted">Phone: {tenantIdentity.phoneE164}</div>
          {tenantIdentity.email && <div className="muted">Email: {tenantIdentity.email}</div>}
          <div className="muted">Verified: {tenantIdentity.verifiedAt ? new Date(tenantIdentity.verifiedAt).toLocaleString() : 'No'}</div>
          <div className="muted">Last login: {tenantIdentity.lastLoginAt ? new Date(tenantIdentity.lastLoginAt).toLocaleString() : 'Never'}</div>
        </div>
      ) : (
        <div className="muted">No mobile identity configured yet.</div>
      )}

      {tenantIdentity?.issues && tenantIdentity.issues.length > 0 && (
        <div className="notice error">
          <strong>Mobile identity needs attention.</strong>
          <ul style={{ margin: '8px 0 0 18px' }}>
            {tenantIdentity.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {isArchived && (
        <div className="notice" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
          This unit is archived. Mobile identity setup and invite delivery are disabled until the property and unit are restored.
        </div>
      )}

      {setupState.error && <div className="notice error">{setupState.error}</div>}
      {inviteState.error && <div className="notice error">{inviteState.error}</div>}
      {deactivateState.error && <div className="notice error">{deactivateState.error}</div>}
      {inviteState.inviteLink && (
        <div className="notice" style={{ background: '#f5fff7', borderColor: '#b7ebc6' }}>
          Invite link: <a href={inviteState.inviteLink}>{inviteState.inviteLink}</a>
        </div>
      )}
      {inviteState.deliveryWarning && (
        <div className="notice" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
          {inviteState.deliveryWarning}
        </div>
      )}

      <form action={setupAction} className="stack">
        <input type="hidden" name="unitId" value={unitId} />
        <label className="field">
          <span className="field-label">Tenant name</span>
          <input className="input" type="text" name="tenantName" defaultValue={tenantIdentity?.tenantName ?? tenantName ?? ''} required />
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
            <input className="input" type="text" name="phoneE164" defaultValue={tenantIdentity?.phoneE164 ?? ''} placeholder="+16025551212 or local format" required style={{ flex: 1 }} />
          </div>
          <span className="field-hint" style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Use E.164 (+16025551212) for any region, or local format with the correct region selected.
          </span>
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" name="email" defaultValue={tenantIdentity?.email ?? tenantEmail ?? ''} placeholder="tenant@example.com" />
        </label>
        <button type="submit" className="button" disabled={setupPending || isArchived}>{setupPending ? 'Saving…' : 'Save mobile identity'}</button>
      </form>

      {tenantIdentity && (
        <div className="row" style={{ justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <form action={inviteAction}>
            <input type="hidden" name="tenantIdentityId" value={tenantIdentity.id} />
            <button type="submit" className="button primary" disabled={invitePending || isArchived}>
              {invitePending ? 'Creating invite…' : 'Create invite link'}
            </button>
          </form>
          <form action={deactivateAction}>
            <input type="hidden" name="tenantIdentityId" value={tenantIdentity.id} />
            <button type="submit" className="button" disabled={deactivatePending}>
              {deactivatePending ? 'Deactivating…' : 'Deactivate mobile access'}
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
