'use client'

import { useActionState } from 'react'
import type { MaintenanceRequest } from '@/lib/types'
import { updateTenantBillbackAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

export function RequestBillbackForm({
  requestId,
  decision,
  amountCents,
  reason,
}: {
  requestId: string
  decision?: MaintenanceRequest['tenantBillbackDecision']
  amountCents?: number
  reason?: string
}) {
  const [state, action, pending] = useActionState(updateTenantBillbackAction, INITIAL_STATE)

  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span className="field-label">Tenant bill-back decision</span>
        <select className="input" name="tenantBillbackDecision" defaultValue={decision ?? 'none'}>
          <option value="none">No bill-back decision</option>
          <option value="bill_tenant">Bill tenant</option>
          <option value="waived">Waive tenant bill-back</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">Flat amount</span>
        <input className="input" type="number" min="0" step="0.01" name="tenantBillbackAmount" defaultValue={typeof amountCents === 'number' ? (amountCents / 100).toFixed(2) : ''} placeholder="0.00" />
      </label>
      <label className="field">
        <span className="field-label">Reason</span>
        <textarea className="input" rows={3} name="tenantBillbackReason" defaultValue={reason ?? ''} placeholder="Why the tenant is responsible, or why it was waived" />
      </label>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Bill-back decision saved.</div> : null}
      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Saving…' : 'Save bill-back decision'}
      </button>
    </form>
  )
}
