'use client'

import { useActionState } from 'react'
import { createBillingDocumentAction, type BillingActionState } from '@/lib/billing-actions'

const INITIAL_STATE: BillingActionState = { error: null }

export function BillingDocumentForm({
  requestId,
  tenantEmail,
  vendorEmail,
}: {
  requestId: string
  tenantEmail?: string
  vendorEmail?: string
}) {
  const [state, action, pending] = useActionState(createBillingDocumentAction, INITIAL_STATE)

  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Recipient type</span>
          <select className="input" name="recipientType" defaultValue="tenant">
            <option value="tenant">Tenant invoice</option>
            <option value="vendor">Vendor remittance</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Send to</span>
          <input className="input" name="sentTo" placeholder={tenantEmail || vendorEmail || 'email@example.com'} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Document title</span>
        <input className="input" name="title" placeholder="Invoice / payment statement title" required />
      </label>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Amount</span>
          <input className="input" name="amount" placeholder="250.00" required />
        </label>
        <label className="field">
          <span className="field-label">Already paid</span>
          <input className="input" name="paidAmount" placeholder="0.00" />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Description</span>
        <textarea className="input textarea" name="description" placeholder="What this bill or remittance covers" rows={4} />
      </label>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Billing document created.</div> : null}
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Saving…' : 'Create billing document'}
      </button>
    </form>
  )
}
