export function AppointmentDateTimeFields() {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Appointment date</span>
          <input className="input" type="date" name="appointmentStartDate" required />
        </label>
        <label className="field">
          <span className="field-label">Start time</span>
          <input className="input" type="time" name="appointmentStartTime" required />
        </label>
      </div>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">End date, optional</span>
          <input className="input" type="date" name="appointmentEndDate" />
        </label>
        <label className="field">
          <span className="field-label">End time, optional</span>
          <input className="input" type="time" name="appointmentEndTime" />
        </label>
      </div>
      <div className="muted">The selected date and time are saved with the appointment.</div>
    </div>
  )
}
