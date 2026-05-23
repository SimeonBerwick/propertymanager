'use client'

import { useActionState } from 'react'
import { createVendorCommercialItemAction, type VendorCommercialActionState } from './commercial-actions'

const INITIAL_STATE: VendorCommercialActionState = { error: null }

export function VendorCommercialItemForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(createVendorCommercialItemAction, INITIAL_STATE)

  return (
    <form action={action} className="stack">
      <input type="hidden" name="requestId" value={requestId} />
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">Commercial item submitted to the property manager.</div> : null}
      <label className="field">
        <span className="field-label">Submission type</span>
        <select className="input" name="itemType" defaultValue="bid">
          <option value="bid">Bid</option>
          <option value="service_fee">Service fee</option>
          <option value="overcost">Overcost</option>
          <option value="bill_to_property_manager">Bill to property manager</option>
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
        <textarea className="input" name="description" rows={3} placeholder="Optional scope, rationale, or commercial note" />
      </label>
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Submitting…' : 'Submit to property manager'}
      </button>
    </form>
  )
}
