'use client'

import { useActionState } from 'react'
import type { MaintenanceRequest } from '@/lib/types'
import { updateTenantBillbackAction, type RequestActionState } from '@/lib/request-detail-actions'
import { ActionFeedback } from '@/components/action-feedback'

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
        <span className="field-label">Should the tenant be charged?</span>
        <select className="input" name="tenantBillbackDecision" defaultValue={decision ?? 'none'}>
          <option value="none">Not decided yet</option>
          <option value="bill_tenant">Yes, charge tenant</option>
          <option value="waived">No, waive tenant charge</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">Tenant charge amount</span>
        <input className="input" type="number" min="0" step="0.01" name="tenantBillbackAmount" defaultValue={typeof amountCents === 'number' ? (amountCents / 100).toFixed(2) : ''} placeholder="0.00" />
      </label>
      <label className="field">
        <span className="field-label">Reason shown in the record</span>
        <textarea className="input" rows={3} name="tenantBillbackReason" defaultValue={reason ?? ''} placeholder="Explain why the tenant is being charged, or why the charge was waived" />
      </label>
      <ActionFeedback error={state.error} success={state.success && 'Tenant charge decision saved.'} />
      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Saving...' : 'Save tenant charge decision'}
      </button>
    </form>
  )
}
