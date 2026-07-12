'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { createPropertyAction, type PropertyActionState } from '@/lib/property-actions'

const INITIAL_STATE: PropertyActionState = { error: null }

export function NewPropertyForm() {
  const [state, formAction, isPending] = useActionState(createPropertyAction, INITIAL_STATE)
  const [propertyType, setPropertyType] = useState<'single_family' | 'multifamily'>('single_family')

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="notice error">{state.error}</div>}

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label">Property type</legend>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <label className="row" style={{ justifyContent: 'flex-start' }}>
            <input type="radio" name="propertyType" value="single_family" checked={propertyType === 'single_family'} onChange={() => setPropertyType('single_family')} />
            Single-family or small property
          </label>
          <label className="row" style={{ justifyContent: 'flex-start' }}>
            <input type="radio" name="propertyType" value="multifamily" checked={propertyType === 'multifamily'} onChange={() => setPropertyType('multifamily')} />
            Apartment community
          </label>
        </div>
      </fieldset>

      <label className="field">
        <span className="field-label">{propertyType === 'multifamily' ? 'Apartment or community name' : 'Property name'}</span>
        <input
          className="input"
          type="text"
          name="name"
          placeholder={propertyType === 'multifamily' ? 'Canyon View Apartments' : 'Canyon View Duplex'}
          maxLength={200}
          required
        />
      </label>

      {propertyType === 'multifamily' ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="grid cols-2">
            <label className="field">
              <span className="field-label">Number of units</span>
              <input className="input" type="number" name="unitCount" min="1" max="500" defaultValue="10" required />
            </label>
            <label className="field">
              <span className="field-label">First unit number</span>
              <input className="input" type="number" name="firstUnitNumber" min="0" max="99999" defaultValue="1" required />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Unit label prefix</span>
            <input className="input" name="unitLabelPrefix" maxLength={80} defaultValue="Unit" placeholder="Unit" />
            <span className="muted">For example, 10 units starting at 101 become Unit 101 through Unit 110.</span>
          </label>
        </div>
      ) : null}

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
