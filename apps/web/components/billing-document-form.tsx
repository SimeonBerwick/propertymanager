'use client'

import { useActionState, useMemo, useState } from 'react'
import { createBillingDocumentAction, type BillingActionState } from '@/lib/billing-actions'

const INITIAL_STATE: BillingActionState = { error: null }

const PRESETS = {
  tenant_damage: {
    recipientType: 'tenant',
    title: 'Tenant damage chargeback invoice',
    description: 'Chargeback for maintenance work caused by tenant-responsible damage or misuse.',
  },
  tenant_reimbursement: {
    recipientType: 'tenant',
    title: 'Tenant reimbursement invoice',
    description: 'Invoice for tenant-responsible maintenance reimbursement.',
  },
  vendor_partial: {
    recipientType: 'vendor',
    title: 'Vendor partial payment remittance',
    description: 'Partial payment statement for completed maintenance work.',
  },
  vendor_paid: {
    recipientType: 'vendor',
    title: 'Vendor paid-in-full remittance',
    description: 'Paid-in-full statement for completed maintenance work.',
  },
} as const

type BillingPresetKey = keyof typeof PRESETS

export function BillingDocumentForm({
  requestId,
  tenantEmail,
  vendorEmail,
  tenantBillbackDecision,
  tenantBillbackAmountCents,
  tenantBillbackReason,
}: {
  requestId: string
  tenantEmail?: string
  vendorEmail?: string
  tenantBillbackDecision?: 'none' | 'bill_tenant' | 'waived'
  tenantBillbackAmountCents?: number
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
        <span className="field-label">Scenario preset</span>
        <select className="input" name="preset" value={presetKey} onChange={(event) => setPresetKey(event.target.value as BillingPresetKey)}>
          <option value="tenant_damage">Tenant damage chargeback</option>
          <option value="tenant_reimbursement">Tenant reimbursement</option>
          <option value="vendor_partial">Vendor partial payment</option>
          <option value="vendor_paid">Vendor paid in full</option>
        </select>
      </label>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Recipient type</span>
          <select className="input" name="recipientType" value={preset.recipientType} onChange={() => undefined}>
            <option value="tenant">Tenant invoice</option>
            <option value="vendor">Vendor remittance</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Send to</span>
          <input key={`sentTo-${presetKey}`} className="input" name="sentTo" placeholder={defaultSentTo || 'email@example.com'} defaultValue={defaultSentTo} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Document title</span>
        <input key={`title-${presetKey}`} className="input" name="title" defaultValue={preset.title} required />
      </label>
      <div className="grid cols-3">
        <label className="field">
          <span className="field-label">Amount</span>
          <input className="input" name="amount" placeholder="250.00" defaultValue={tenantBillbackDecision === 'bill_tenant' && typeof tenantBillbackAmountCents === 'number' ? (tenantBillbackAmountCents / 100).toFixed(2) : ''} required />
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
        <textarea key={`description-${presetKey}`} className="input textarea" name="description" defaultValue={tenantBillbackDecision === 'bill_tenant' && tenantBillbackReason ? tenantBillbackReason : preset.description} placeholder="What this bill or remittance covers" rows={4} />
      </label>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Billing document created.</div> : null}
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Saving…' : 'Create billing document'}
      </button>
    </form>
  )
}
