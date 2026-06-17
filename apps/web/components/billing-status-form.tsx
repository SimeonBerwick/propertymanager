'use client'

import { useActionState } from 'react'
import { updateBillingDocumentAction, type BillingActionState } from '@/lib/billing-actions'
import { ActionFeedback } from '@/components/action-feedback'
import type { BillingDocumentView } from '@/lib/billing-types'

const INITIAL_STATE: BillingActionState = { error: null }

export function BillingStatusForm({ document }: { document: BillingDocumentView }) {
  const [state, action, pending] = useActionState(updateBillingDocumentAction, INITIAL_STATE)
  const balanceCents = Math.max(document.totalCents - document.paidCents, 0)
  const paidInFullValue = (document.totalCents / 100).toFixed(2)

  return (
    <div className="billingStatusStack">
      <form action={action} className="billingStatusForm">
        <input type="hidden" name="billingDocumentId" value={document.id} />
        <input type="hidden" name="requestId" value={document.requestId} />
        <label className="field">
          <span className="field-label">Paid amount</span>
          <input className="input" name="paidAmount" defaultValue={(document.paidCents / 100).toFixed(2)} />
        </label>
        <button type="submit" className="button">{pending ? 'Updating...' : 'Update payment state'}</button>
      </form>
      {balanceCents > 0 && document.status !== 'void' ? (
        <form action={action} className="billingStatusForm">
          <input type="hidden" name="billingDocumentId" value={document.id} />
          <input type="hidden" name="requestId" value={document.requestId} />
          <input type="hidden" name="paidAmount" value={paidInFullValue} />
          <button type="submit" className="button primary">{pending ? 'Updating...' : 'Mark paid in full'}</button>
        </form>
      ) : null}
      <ActionFeedback error={state.error} success={state.success && 'Billing updated.'} />
    </div>
  )
}
