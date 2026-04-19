'use client'

import { useActionState } from 'react'
import { submitVendorResponse, type VendorResponseState } from './actions'

const INITIAL_STATE: VendorResponseState = { error: null }

export function VendorResponseForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(submitVendorResponse, INITIAL_STATE)

  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      {state.error ? <div className="notice error">{state.error}</div> : null}

      <label className="field">
        <span className="field-label">Response</span>
        <select className="input" name="dispatchStatus" defaultValue="accepted">
          <option value="contacted">Contacted</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="canceled">Canceled after acceptance</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
        </select>
      </label>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Bid amount (USD)</span>
          <input className="input" type="number" step="0.01" min="0" name="bidAmount" placeholder="250.00" />
        </label>
        <label className="field">
          <span className="field-label">Availability note</span>
          <input className="input" type="text" name="availabilityNote" placeholder="Can attend Thursday morning" />
        </label>
      </div>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Scheduled start</span>
          <input className="input" type="datetime-local" name="scheduledStart" />
        </label>
        <label className="field">
          <span className="field-label">Scheduled end</span>
          <input className="input" type="datetime-local" name="scheduledEnd" />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Note</span>
        <textarea className="input" name="note" rows={4} placeholder="Optional note for scope, scheduling, or completion details" />
      </label>

      <label className="field">
        <span className="field-label">Photos</span>
        <input className="input" type="file" name="photos" accept="image/*" multiple />
      </label>

      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Submitting…' : 'Send response'}
      </button>
    </form>
  )
}
