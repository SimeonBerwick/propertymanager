'use client'

import { useActionState, useState } from 'react'
import { submitVendorPortalResponse, type VendorPortalResponseState } from './actions'

const INITIAL_STATE: VendorPortalResponseState = { error: null }

export function VendorRequestResponseForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(submitVendorPortalResponse, INITIAL_STATE)
  const [response, setResponse] = useState('contacted')
  const showBid = response === 'contacted' || response === 'accepted'
  const showSchedule = response === 'scheduled'
  const showPhotos = response === 'completed'

  return (
    <form action={action} className="stack">
      <input type="hidden" name="requestId" value={requestId} />
      {state.error ? <div className="notice error">{state.error}</div> : null}

      <label className="field">
        <span className="field-label">Response</span>
        <select className="input" name="dispatchStatus" value={response} onChange={(event) => setResponse(event.target.value)}>
          <option value="contacted">Contacted</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
          <option value="canceled">Canceled after acceptance</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
        </select>
      </label>

      {showBid ? <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Bid amount (USD)</span>
          <input className="input" type="number" step="0.01" min="0" name="bidAmount" placeholder="250.00" />
        </label>
        <label className="field">
          <span className="field-label">Availability note</span>
          <input className="input" type="text" name="availabilityNote" placeholder="Can attend Thursday morning" />
        </label>
      </div> : null}

      {showSchedule ? <div className="stack" style={{ gap: 8 }}>
        <div className="notice">This appointment time will be sent to the tenant.</div>
        <div className="grid cols-2">
          <label className="field">
            <span className="field-label">Appointment start</span>
            <input className="input" type="datetime-local" name="scheduledStart" required />
          </label>
          <label className="field">
            <span className="field-label">Appointment end, optional</span>
            <input className="input" type="datetime-local" name="scheduledEnd" />
          </label>
        </div>
      </div> : null}

      <label className="field">
        <span className="field-label">Note</span>
        <textarea className="input" name="note" rows={4} placeholder={response === 'declined' ? 'Tell the manager why you cannot take this work' : response === 'scheduled' ? 'Optional tenant-visible scheduling note' : response === 'completed' ? 'Summarize the completed work' : 'Optional details for the property manager'} />
      </label>

      {showPhotos ? <label className="field">
        <span className="field-label">Photos</span>
        <input className="input" type="file" name="photos" accept="image/*" multiple />
        <span className="muted">Up to 3 photos total per work order, 5 MB each. If upload fails, remove large photos and try again.</span>
      </label> : null}

      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Submitting…' : 'Send update'}
      </button>
    </form>
  )
}
