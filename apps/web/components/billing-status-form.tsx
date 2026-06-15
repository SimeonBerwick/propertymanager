'use client'

import { useActionState } from 'react'
import { updateBillingDocumentAction, type BillingActionState } from '@/lib/billing-actions'
import { ActionFeedback } from '@/components/action-feedback'
import type { BillingDocumentView } from '@/lib/billing-types'

const INITIAL_STATE: BillingActionState = { error: null }

export function BillingStatusForm({ document }: { document: BillingDocumentView }) {
  const [state, action, pending] = useActionState(updateBillingDocumentAction, INITIAL_STATE)

  return (
    <form action={action} className="billingStatusForm">
      <input type="hidden" name="billingDocumentId" value={document.id} />
      <input type="hidden" name="requestId" value={document.requestId} />
      <label className="field">
        <span className="field-label">Paid amount</span>
        <input className="input" name="paidAmount" defaultValue={(document.paidCents / 100).toFixed(2)} />
      </label>
      <button type="submit" className="button">{pending ? 'Updating…' : 'Update payment state'}</button>
      <ActionFeedback error={state.error} success={state.success && 'Billing updated.'} />
    </form>
  )
}
