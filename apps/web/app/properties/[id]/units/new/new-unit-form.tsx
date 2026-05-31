'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createUnitAction, type PropertyActionState } from '@/lib/property-actions'

const INITIAL_STATE: PropertyActionState = { error: null }

interface NewUnitFormProps {
  propertyId: string
}

export function NewUnitForm({ propertyId }: NewUnitFormProps) {
  const [state, formAction, isPending] = useActionState(createUnitAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="notice error">{state.error}</div>}

      <input type="hidden" name="propertyId" value={propertyId} />

      <label className="field">
        <span className="field-label">Unit label</span>
        <input
          className="input"
          type="text"
          name="label"
          placeholder="Unit A, 101, Front House…"
          maxLength={100}
          required
        />
      </label>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">
            Tenant name <span className="muted">(optional)</span>
          </span>
          <input className="input" type="text" name="tenantName" placeholder="Taylor Reed" maxLength={120} />
        </label>

        <label className="field">
          <span className="field-label">
            Tenant email <span className="muted">(optional)</span>
          </span>
          <input className="input" type="email" name="tenantEmail" placeholder="taylor@example.com" maxLength={254} />
        </label>
      </div>

      <div className="grid cols-4">
        <label className="field">
          <span className="field-label">Sq ft</span>
          <input className="input" type="number" name="sizeSqFt" placeholder="920" min={0} max={100000} inputMode="numeric" />
        </label>

        <label className="field">
          <span className="field-label">Beds</span>
          <input className="input" type="number" name="bedrooms" placeholder="2" min={0} max={100} inputMode="numeric" />
        </label>

        <label className="field">
          <span className="field-label">Baths</span>
          <input className="input" type="number" name="bathrooms" placeholder="1.5" min={0} max={100} step={0.5} inputMode="decimal" />
        </label>

        <label className="field">
          <span className="field-label">Rent</span>
          <input className="input" type="number" name="monthlyRent" placeholder="1650" min={0} max={1000000} step={0.01} inputMode="decimal" />
        </label>
      </div>

      <div className="row">
        <Link href={`/properties/${propertyId}`} className="button">Cancel</Link>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? 'Adding…' : 'Add unit'}
        </button>
      </div>
    </form>
  )
}
