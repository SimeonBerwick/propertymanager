'use client'

import { useActionState, useState } from 'react'
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
  const [selectedDecision, setSelectedDecision] = useState(decision ?? 'none')
  const needsChargeDetails = selectedDecision === 'bill_tenant'
  const showsOptionalNote = selectedDecision === 'waived'

  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span className="field-label">Should the tenant be charged?</span>
        <select className="input" name="tenantBillbackDecision" value={selectedDecision} onChange={(event) => setSelectedDecision(event.target.value as typeof selectedDecision)}>
          <option value="none">No tenant chargeback</option>
          <option value="bill_tenant">Yes, charge tenant</option>
          <option value="waived">Waive a possible tenant charge</option>
        </select>
      </label>
      {needsChargeDetails ? (
        <>
          <label className="field">
            <span className="field-label">Tenant charge amount</span>
            <input className="input" type="number" min="0" step="0.01" name="tenantBillbackAmount" defaultValue={typeof amountCents === 'number' && amountCents > 0 ? (amountCents / 100).toFixed(2) : ''} placeholder="0.00" />
          </label>
          <label className="field">
            <span className="field-label">Reason for tenant charge</span>
            <textarea className="input" rows={3} name="tenantBillbackReason" defaultValue={reason ?? ''} placeholder="Plain-English reason shown in the record" />
          </label>
        </>
      ) : null}
      {showsOptionalNote ? (
        <label className="field">
          <span className="field-label">Optional waiver note</span>
          <textarea className="input" rows={3} name="tenantBillbackReason" defaultValue={reason ?? ''} placeholder="Optional note for the record" />
        </label>
      ) : null}
      <ActionFeedback error={state.error} success={state.success && 'Tenant charge decision saved.'} />
      <button type="submit" className="button" disabled={pending}>
        {pending ? 'Saving...' : 'Save tenant charge decision'}
      </button>
    </form>
  )
}
