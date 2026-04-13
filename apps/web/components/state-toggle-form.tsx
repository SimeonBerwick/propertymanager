'use client'

import { useActionState } from 'react'
import type { PropertyActionState } from '@/lib/property-actions'

const INITIAL_STATE: PropertyActionState = { error: null }

interface StateToggleFormProps {
  action: (state: PropertyActionState, formData: FormData) => Promise<PropertyActionState>
  hiddenFields: { name: string; value: string }[]
  submitLabel: string
  tone?: 'default' | 'warn'
  helperText?: string
}

export function StateToggleForm({ action, hiddenFields, submitLabel, tone = 'default', helperText }: StateToggleFormProps) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {hiddenFields.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}

      {helperText && <div className="muted">{helperText}</div>}
      {state.error && <div className="notice error">{state.error}</div>}

      <button type="submit" className={`button ${tone === 'warn' ? 'warnButton' : ''}`} disabled={isPending}>
        {isPending ? 'Working…' : submitLabel}
      </button>
    </form>
  )
}
