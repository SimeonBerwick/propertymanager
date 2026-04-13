'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { updatePropertyAction, type PropertyActionState } from '@/lib/property-actions'

const INITIAL_STATE: PropertyActionState = { error: null }

interface EditPropertyFormProps {
  propertyId: string
  initialName: string
  initialAddress: string
}

export function EditPropertyForm({ propertyId, initialName, initialAddress }: EditPropertyFormProps) {
  const [state, formAction, isPending] = useActionState(updatePropertyAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="notice error">{state.error}</div>}

      <input type="hidden" name="propertyId" value={propertyId} />

      <label className="field">
        <span className="field-label">Property name</span>
        <input
          className="input"
          type="text"
          name="name"
          defaultValue={initialName}
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
          defaultValue={initialAddress}
          maxLength={400}
          required
        />
      </label>

      <div className="row">
        <Link href={`/properties/${propertyId}`} className="button">Cancel</Link>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save property'}
        </button>
      </div>
    </form>
  )
}
