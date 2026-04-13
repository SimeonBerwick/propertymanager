'use client'

import { useActionState } from 'react'
import type { ReactNode } from 'react'
import type { PropertyActionState } from '@/lib/property-actions'

const INITIAL_STATE: PropertyActionState = { error: null }

interface DangerZoneFormProps {
  action: (state: PropertyActionState, formData: FormData) => Promise<PropertyActionState>
  hiddenFields: { name: string; value: string }[]
  title: string
  description: ReactNode
  confirmationLabel: string
  confirmationValue: string
  submitLabel: string
}

export function DangerZoneForm({
  action,
  hiddenFields,
  title,
  description,
  confirmationLabel,
  confirmationValue,
  submitLabel,
}: DangerZoneFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE)

  return (
    <form action={formAction} className="stack dangerZone">
      <div>
        <div className="kicker" style={{ color: 'var(--danger)' }}>Danger zone</div>
        <h3 style={{ margin: '4px 0 0' }}>{title}</h3>
      </div>

      <div className="muted">{description}</div>

      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}

      <label className="field">
        <span className="field-label">{confirmationLabel}</span>
        <input
          className="input"
          type="text"
          name="confirmation"
          placeholder={confirmationValue}
          autoComplete="off"
          required
        />
      </label>

      {state.error && <div className="notice error">{state.error}</div>}

      <div className="row">
        <button type="submit" className="button dangerButton" disabled={isPending}>
          {isPending ? 'Working…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
