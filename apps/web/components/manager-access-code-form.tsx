'use client'

import { useActionState, useState } from 'react'
import {
  createTenantAccessCodeAction,
  createVendorAccessCodeAction,
  type ManagerAccessCodeState,
} from '@/lib/manager-access-actions'

const INITIAL_STATE: ManagerAccessCodeState = { error: null }

interface ManagerAccessCodeFormProps {
  role: 'tenant' | 'vendor'
  recipientId: string
  recipientName: string
  requests?: Array<{ id: string; title: string; unitLabel?: string }>
  disabled?: boolean
}

export function ManagerAccessCodeForm({ role, recipientId, recipientName, requests = [], disabled = false }: ManagerAccessCodeFormProps) {
  const action = role === 'tenant' ? createTenantAccessCodeAction : createVendorAccessCodeAction
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE)
  const [validFromLocal, setValidFromLocal] = useState('')

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name={role === 'tenant' ? 'tenantIdentityId' : 'vendorId'} value={recipientId} />
      <input type="hidden" name="validFrom" value={validFromLocal ? new Date(validFromLocal).toISOString() : ''} />
      <div className="muted">
        Generate a one-time code for {recipientName}. The code is emailed automatically and can be used once.
      </div>
      {role === 'vendor' && requests.length === 0 ? (
        <div className="notice" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
          Assign this vendor to a request first. Vendor access codes must be scoped to one work order.
        </div>
      ) : null}
      {role === 'vendor' ? (
        <label className="field">
          <span className="field-label">Work-order access scope</span>
          <select className="input" name="requestId" required defaultValue="">
            <option value="" disabled>Select an assigned request</option>
            {requests.map((request) => (
              <option key={request.id} value={request.id}>{request.title}{request.unitLabel ? ` - ${request.unitLabel}` : ''}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Starts</span>
          <input
            className="input"
            type="datetime-local"
            value={validFromLocal}
            onChange={(event) => setValidFromLocal(event.target.value)}
          />
          <span className="field-hint">Leave blank to start immediately.</span>
        </label>
        <label className="field">
          <span className="field-label">Duration</span>
          <select className="input" name="durationHours" defaultValue="24">
            <option value="1">1 hour</option>
            <option value="4">4 hours</option>
            <option value="24">24 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </label>
      </div>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.code ? (
        <div className="notice success">
          Access code: <strong style={{ letterSpacing: 3 }}>{state.code}</strong>
          <div className="muted">Scope: {state.scope}. Expires {new Date(state.expiresAt!).toLocaleString()}.</div>
        </div>
      ) : null}
      {state.deliveryWarning ? (
        <div className="notice" style={{ background: '#fffbeb', borderColor: '#fcd34d' }}>
          {state.deliveryWarning}
        </div>
      ) : null}
      <button className="button primary" type="submit" disabled={pending || disabled || (role === 'vendor' && requests.length === 0)}>
        {pending ? 'Sending new code...' : 'Send new access code'}
      </button>
    </form>
  )
}
