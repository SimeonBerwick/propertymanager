'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createPropertyAction, type PropertyActionState } from '@/lib/property-actions'

const INITIAL_STATE: PropertyActionState = { error: null }

export function NewPropertyForm() {
  const [state, formAction, isPending] = useActionState(createPropertyAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="notice error">{state.error}</div>}

      <label className="field">
        <span className="field-label">Property name</span>
        <input
          className="input"
          type="text"
          name="name"
          placeholder="Canyon View Duplex"
          maxLength={200}
          required
        />
      </label>

      <label className="field">
        <span className="field-label">Address</span>
        <input
          className="input"
          type="text"
          name="address"
          placeholder="1234 Main St, Phoenix, AZ 85001"
          maxLength={400}
          required
        />
      </label>

      <div className="row">
        <Link href="/properties" className="button">Cancel</Link>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? 'Creating…' : 'Add property'}
        </button>
      </div>
    </form>
  )
}
