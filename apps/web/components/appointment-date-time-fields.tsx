'use client'

import { useMemo, useState } from 'react'

function combineDateTime(date: string, time: string) {
  return date && time ? `${date}T${time}` : ''
}

export function AppointmentDateTimeFields() {
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const scheduledStart = useMemo(() => combineDateTime(startDate, startTime), [startDate, startTime])
  const scheduledEnd = useMemo(() => combineDateTime(endDate || startDate, endTime), [endDate, endTime, startDate])

  return (
    <div className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="scheduledStart" value={scheduledStart} />
      <input type="hidden" name="scheduledEnd" value={scheduledEnd} />
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Appointment date</span>
          <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field-label">Start time</span>
          <input className="input" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
        </label>
      </div>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">End date, optional</span>
          <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">End time, optional</span>
          <input className="input" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>
      </div>
      <div className="muted">The selected date and time are saved with the appointment.</div>
    </div>
  )
}
