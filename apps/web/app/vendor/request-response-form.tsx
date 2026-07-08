'use client'

import { useActionState, useState } from 'react'
import { submitVendorPortalResponse, type VendorPortalResponseState } from './actions'
import { AppointmentDateTimeFields } from '@/components/appointment-date-time-fields'

const INITIAL_STATE: VendorPortalResponseState = { error: null }

function blurActiveField(form: HTMLFormElement) {
  const active = form.ownerDocument.activeElement
  if (active instanceof HTMLElement) active.blur()
}

export function VendorRequestResponseForm({
  requestId,
  initialResponse = 'contacted',
  hasAppointment = false,
  pendingBid = false,
}: {
  requestId: string
  initialResponse?: string
  hasAppointment?: boolean
  pendingBid?: boolean
}) {
  const [state, action, pending] = useActionState(submitVendorPortalResponse, INITIAL_STATE)
  const [response, setResponse] = useState(initialResponse)
  const showBid = pendingBid && (response === 'contacted' || response === 'accepted')
  const showSchedule = response === 'scheduled'
  const showPhotos = response === 'completed'
  const responseOptions = hasAppointment && !pendingBid
    ? [
        ['in_progress', 'Started work'],
        ['completed', 'Completed'],
        ['canceled', 'Cannot continue'],
      ]
    : [
        ['contacted', 'Contacted'],
        ['accepted', 'Accepted'],
        ['declined', 'Declined'],
        ['canceled', 'Canceled after acceptance'],
        ['scheduled', 'Scheduled'],
        ['completed', 'Completed'],
      ]

  return (
    <form action={action} className="stack" onSubmit={(event) => blurActiveField(event.currentTarget)}>
      <input type="hidden" name="requestId" value={requestId} />
      {state.error ? <div className="notice error">{state.error}</div> : null}

      <label className="field">
        <span className="field-label">Response</span>
        <select className="input" name="dispatchStatus" value={response} onChange={(event) => setResponse(event.target.value)}>
          {responseOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
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
        <AppointmentDateTimeFields />
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
        {pending ? 'Submitting...' : response === 'scheduled' ? 'Save appointment' : 'Send work update'}
      </button>
    </form>
  )
}
