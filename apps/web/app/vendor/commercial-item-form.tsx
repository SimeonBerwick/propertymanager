'use client'

import { useActionState } from 'react'
import { createVendorCommercialItemAction, type VendorCommercialActionState } from './commercial-actions'

const INITIAL_STATE: VendorCommercialActionState = { error: null }

export function VendorCommercialItemForm({
  requestId,
  defaultItemType = 'bid',
  context = 'general',
}: {
  requestId: string
  defaultItemType?: 'bid' | 'service_fee' | 'overcost' | 'bill_to_property_manager'
  context?: 'general' | 'service_call'
}) {
  const [state, action, pending] = useActionState(createVendorCommercialItemAction, INITIAL_STATE)
  const typeOptions = context === 'service_call'
    ? [
        { value: 'service_fee', label: 'Service charge' },
        { value: 'overcost', label: 'Parts only' },
        { value: 'bid', label: 'Estimated repair cost' },
        { value: 'bill_to_property_manager', label: 'Final invoice' },
      ]
    : [
        { value: 'bid', label: 'Bid' },
        { value: 'service_fee', label: 'Service fee' },
        { value: 'overcost', label: 'Extra cost' },
        { value: 'bill_to_property_manager', label: 'Invoice property manager' },
      ]

  return (
    <form action={action} className="stack">
      <input type="hidden" name="requestId" value={requestId} />
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Invoice item submitted to the property manager.</div> : null}
      <label className="field">
        <span className="field-label">Submission type</span>
        <select className="input" name="itemType" defaultValue={defaultItemType}>
          {typeOptions.map((option) => (
            <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Title</span>
          <input className="input" type="text" name="title" placeholder="Replacement parts and labor" required />
        </label>
        <label className="field">
          <span className="field-label">Amount (USD)</span>
          <input className="input" type="number" name="amount" step="0.01" min="0.01" placeholder="250.00" required />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Description</span>
        <textarea className="input" name="description" rows={3} placeholder="Optional scope, reason, or invoice note" />
      </label>
      <label className="field">
        <span className="field-label">Attach bill PDF or photo</span>
        <input className="input" type="file" name="attachment" accept="application/pdf,image/*,.pdf" />
        <span className="muted">Optional. Add the invoice PDF or a photo of the bill for the property manager. Max 10 MB.</span>
      </label>
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Submitting...' : 'Submit to property manager'}
      </button>
    </form>
  )
}
