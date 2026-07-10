'use client'

import { useState } from 'react'

export function AppointmentDateTimeFields() {
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Appointment date</span>
          <input className="input" type="date" name="appointmentStartDate" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Start time</span>
          <input className="input" type="time" name="appointmentStartTime" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
        </label>
      </div>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">End date, optional</span>
          <input className="input" type="date" name="appointmentEndDate" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">End time, optional</span>
          <input className="input" type="time" name="appointmentEndTime" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>
      </div>
      <div className="muted">The selected date and time are saved with the appointment.</div>
    </div>
  )
}
