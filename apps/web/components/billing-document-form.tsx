'use client'

import { useActionState, useMemo, useState } from 'react'
import { createBillingDocumentAction, type BillingActionState } from '@/lib/billing-actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: BillingActionState = { error: null }

const PRESETS = {
  tenant_damage: {
    recipientType: 'tenant',
    title: 'Tenant chargeback invoice',
    description: 'Charge the tenant for the approved tenant-responsible amount on this request.',
  },
  tenant_reimbursement: {
    recipientType: 'tenant',
    title: 'Record tenant reimbursement invoice',
    description: 'Bill the tenant for an agreed maintenance reimbursement.',
  },
  vendor_partial: {
    recipientType: 'vendor',
    title: 'Record partial vendor payment',
    description: 'Record a partial payment made to the vendor for this request.',
  },
  vendor_paid: {
    recipientType: 'vendor',
    title: 'Record vendor paid in full',
    description: 'Record that the approved vendor amount has been paid in full.',
  },
} as const

type BillingPresetKey = keyof typeof PRESETS

export function BillingDocumentForm({
  requestId,
  tenantEmail,
  vendorEmail,
  tenantBillbackDecision,
  tenantBillbackTotal amountCents,
  tenantBillbackReason,
}: {
  requestId: string
  tenantEmail?: string
  vendorEmail?: string
  tenantBillbackDecision?: 'none' | 'bill_tenant' | 'waived'
  tenantBillbackTotal amountCents?: number
  tenantBillbackReason?: string
}) {
  const [state, action, pending] = useActionState(createBillingDocumentAction, INITIAL_STATE)
  const initialPreset: BillingPresetKey = tenantBillbackDecision === 'bill_tenant' ? 'tenant_damage' : 'tenant_damage'
  const [presetKey, setPresetKey] = useState<BillingPresetKey>(initialPreset)
  const preset = PRESETS[presetKey]
  const defaultSentTo = useMemo(() => {
    return preset.recipientType === 'tenant' ? (tenantEmail || '') : (vendorEmail || '')
  }, [preset.recipientType, tenantEmail, vendorEmail])

  return (
    <form action={action} className="stack billingForm" style={{ gap: 10 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span className="field-label">What are you recording?</span>
        <select className="input" name="preset" value={presetKey} onChange={(event) => setPresetKey(event.target.value as BillingPresetKey)}>
          <option value="tenant_damage">Charge tenant for this work</option>
          <option value="tenant_reimbursement">Record tenant reimbursement</option>
          <option value="vendor_partial">Record partial vendor payment</option>
          <option value="vendor_paid">Record vendor payment in full</option>
        </select>
      </label>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Who receives this document?</span>
          <select className="input" name="recipientType" value={preset.recipientType} onChange={() => undefined}>
            <option value="tenant">Tenant charge</option>
            <option value="vendor">Vendor payment record</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Recipient email</span>
          <input key={`sentTo-${presetKey}`} className="input" name="sentTo" placeholder={defaultSentTo || 'email@example.com'} defaultValue={defaultSentTo} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Document name</span>
        <input key={`title-${presetKey}`} className="input" name="title" defaultValue={preset.title} required />
      </label>
      <div className="grid cols-3">
        <label className="field">
          <span className="field-label">Total amount</span>
          <input className="input" name="amount" placeholder="250.00" defaultValue={tenantBillbackDecision === 'bill_tenant' && typeof tenantBillbackTotal amountCents === 'number' ? (tenantBillbackTotal amountCents / 100).toFixed(2) : ''} required />
        </label>
        <label className="field">
          <span className="field-label">Amount already paid</span>
          <input className="input" name="paidTotal amount" placeholder="0.00" />
        </label>
        <label className="field">
          <span className="field-label">Send now?</span>
          <select className="input" name="sendSend now?" defaultValue="send">
            <option value="send">Create and email now</option>
            <option value="draft">Save draft only</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">What is this charge or payment for?</span>
        <textarea key={`description-${presetKey}`} className="input textarea" name="description" defaultValue={tenantBillbackDecision === 'bill_tenant' && tenantBillbackReason ? tenantBillbackReason : preset.description} placeholder="Plain-English explanation for the tenant, vendor, or your records" rows={4} />
      </label>
      <ActionFeedback error={state.error} success={state.success && 'Billing document created.'} />
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Saving...' : 'Create billing document'}
      </button>
    </form>
  )
}
