'use client'

import { useState } from 'react'

export function OtpCodeField() {
  const [code, setCode] = useState('')

  return (
    <label className="field">
      <span className="field-label">Verification code</span>
      <input
        autoFocus
        autoComplete="one-time-code"
        className="input"
        inputMode="numeric"
        maxLength={6}
        name="code"
        pattern="[0-9]{6}"
        placeholder="123456"
        required
        value={code}
        onChange={(event) => {
          const value = event.target.value.replace(/\D/g, '').slice(0, 6)
          setCode(value)
          if (value.length === 6) window.setTimeout(() => event.target.form?.requestSubmit(), 0)
        }}
      />
      <span className="field-hint">The code submits automatically after the sixth digit.</span>
    </label>
  )
}
