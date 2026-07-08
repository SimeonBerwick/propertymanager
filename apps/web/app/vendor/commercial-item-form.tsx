'use client'

import { useActionState, useState } from 'react'
import { createVendorCommercialItemAction, type VendorCommercialActionState } from './commercial-actions'

const INITIAL_STATE: VendorCommercialActionState = { error: null }

type VendorCommercialItemType = 'bid' | 'service_fee' | 'overcost' | 'bill_to_property_manager'

const SERVICE_CALL_TITLES: Record<VendorCommercialItemType, string> = {
  bid: 'Estimated repair cost',
  service_fee: 'Service charge',
  overcost: 'Parts only',
  bill_to_property_manager: 'Final invoice',
}

export function VendorCommercialItemForm({
  requestId,
  defaultItemType = 'bid',
  context = 'general',
}: {
  requestId: string
  defaultItemType?: VendorCommercialItemType
  context?: 'general' | 'service_call'
}) {
  const [state, action, pending] = useActionState(createVendorCommercialItemAction, INITIAL_STATE)
  const [noCharge, setNoCharge] = useState(false)
  const [selectedType, setSelectedType] = useState<VendorCommercialItemType>(defaultItemType)
  const [title, setTitle] = useState(context === 'service_call' ? SERVICE_CALL_TITLES[defaultItemType] : '')
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
      <input type="hidden" name="noCharge" value={noCharge ? 'true' : 'false'} />
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">{state.message ?? 'Invoice item submitted to the property manager.'}</div> : null}
      {context === 'service_call' ? (
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={noCharge}
            onChange={(event) => setNoCharge(event.target.checked)}
          />
          <span>No charge for this service call</span>
        </label>
      ) : null}
      <label className="field">
        <span className="field-label">Submission type</span>
        <select
          className="input"
          name="itemType"
          value={selectedType}
          disabled={noCharge}
          onChange={(event) => {
            const nextType = event.target.value as VendorCommercialItemType
            const currentDefault = SERVICE_CALL_TITLES[selectedType]
            setSelectedType(nextType)
            if (context === 'service_call' && (!title.trim() || title === currentDefault)) {
              setTitle(SERVICE_CALL_TITLES[nextType])
            }
          }}
        >
          {typeOptions.map((option) => (
            <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
          ))}
        </select>
        {noCharge ? <input type="hidden" name="itemType" value="service_fee" /> : null}
      </label>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Title</span>
          <input
            className="input"
            type="text"
            name="title"
            value={noCharge ? 'No charge' : title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={noCharge ? 'No charge' : 'Replacement parts and labor'}
            required={!noCharge}
            readOnly={noCharge}
          />
        </label>
        <label className="field">
          <span className="field-label">Amount (USD)</span>
          <input className="input" type="number" name="amount" step="0.01" min={noCharge ? '0' : '0.01'} placeholder={noCharge ? '0.00' : '250.00'} required={!noCharge} disabled={noCharge} />
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
