'use client'

import { useActionState, useState } from 'react'
import { submitVendorResponse, type VendorResponseState } from './actions'

const INITIAL_STATE: VendorResponseState = { error: null }

function blurActiveField(form: HTMLFormElement) {
  const active = form.ownerDocument.activeElement
  if (active instanceof HTMLElement) active.blur()
}

export function VendorResponseForm({ token, mode }: { token: string; mode: 'bid' | 'service_call' }) {
  const [state, action, pending] = useActionState(submitVendorResponse, INITIAL_STATE)
  const [response, setResponse] = useState('accepted')
  const showBid = mode === 'bid' && response === 'accepted'
  const accepting = response === 'accepted'

  return (
    <form action={action} className="stack" onSubmit={(event) => blurActiveField(event.currentTarget)}>
      <input type="hidden" name="token" value={token} />
      {state.error ? <div className="notice error">{state.error}</div> : null}

      <label className="field">
        <span className="field-label">Response</span>
        <select className="input" name="dispatchStatus" value={response} onChange={(event) => setResponse(event.target.value)}>
          <option value="accepted">{mode === 'bid' ? 'Submit bid' : 'Accept service call'}</option>
          <option value="declined">{mode === 'bid' ? 'Decline invite' : 'Decline service call'}</option>
        </select>
      </label>

      {showBid ? (
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
      ) : null}

      {mode === 'service_call' && accepting ? (
        <label className="field">
          <span className="field-label">Availability note</span>
          <input className="input" type="text" name="availabilityNote" placeholder="Example: Available tomorrow morning" />
        </label>
      ) : null}

      <label className="field">
        <span className="field-label">Note</span>
        <textarea className="input" name="note" rows={4} placeholder={response === 'declined' ? (mode === 'bid' ? 'Tell the manager why you cannot bid on this work' : 'Tell the manager why you cannot accept this service call') : 'Optional note for scope or availability'} />
      </label>

      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Submitting...' : accepting ? (mode === 'bid' ? 'Submit bid' : 'Accept service call') : 'Send response'}
      </button>
    </form>
  )
}
