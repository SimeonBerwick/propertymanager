'use client'

import { useActionState } from 'react'
import { createPropertyAreaAction, type PropertyActionState } from '@/lib/property-actions'

const INITIAL_STATE: PropertyActionState = { error: null }

export function PropertyAreaForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState(createPropertyAreaAction, INITIAL_STATE)
  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <label className="field">
        <span className="field-label">Add another property area</span>
        <input className="input" name="label" maxLength={100} placeholder="Example: Fitness center" required />
      </label>
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">{state.message}</div> : null}
      <button type="submit" className="button" disabled={pending} style={{ alignSelf: 'flex-start' }}>{pending ? 'Adding...' : 'Add area'}</button>
    </form>
  )
}
