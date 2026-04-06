'use client'

import { useActionState, useMemo } from 'react'
import { createBillingDocumentAction, type BillingActionState } from '@/lib/billing-actions'

const INITIAL_STATE: BillingActionState = { error: null }

const PRESETS = {
  tenant: {
    title: 'Tenant chargeback invoice',
    description: 'Chargeback for maintenance work billed to tenant responsibility.',
  },
  vendor: {
    title: 'Vendor payment remittance',
    description: 'Payment statement for completed maintenance work.',
  },
} as const

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
  const tenantPreset = useMemo(() => PRESETS.tenant, [])

  return (
    <form action={action} className="stack billingForm" style={{ gap: 10 }}>
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
          <input className="input" name="sentTo" placeholder={tenantEmail || vendorEmail || 'email@example.com'} defaultValue={tenantEmail || ''} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Document title</span>
        <input className="input" name="title" defaultValue={tenantPreset.title} required />
      </label>
      <div className="grid cols-3">
        <label className="field">
          <span className="field-label">Amount</span>
          <input className="input" name="amount" placeholder="250.00" required />
        </label>
        <label className="field">
          <span className="field-label">Already paid</span>
          <input className="input" name="paidAmount" placeholder="0.00" />
        </label>
        <label className="field">
          <span className="field-label">Mode</span>
          <select className="input" name="sendMode" defaultValue="send">
            <option value="send">Create and send</option>
            <option value="draft">Create draft only</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Description</span>
        <textarea className="input textarea" name="description" defaultValue={tenantPreset.description} placeholder="What this bill or remittance covers" rows={4} />
      </label>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Billing document created.</div> : null}
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Saving…' : 'Create billing document'}
      </button>
    </form>
  )
}
