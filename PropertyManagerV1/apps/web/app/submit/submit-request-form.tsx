'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import type { Property, Unit } from '@/lib/types'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { submitMaintenanceRequest, type SubmitRequestState } from '@/lib/request-actions'

const INITIAL_STATE: SubmitRequestState = { error: null }

interface SubmitRequestFormProps {
  properties: Property[]
  units: Unit[]
  orgSlug?: string
}

export function SubmitRequestForm({ properties, units, orgSlug }: SubmitRequestFormProps) {
  const [state, formAction, isPending] = useActionState(submitMaintenanceRequest, INITIAL_STATE)
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id ?? '')
  const [selectedUnitId, setSelectedUnitId] = useState('')

  const filteredUnits = useMemo(
    () => units.filter((unit) => unit.propertyId === selectedPropertyId),
    [selectedPropertyId, units],
  )

  useEffect(() => {
    if (!filteredUnits.length) {
      setSelectedUnitId('')
      return
    }

    if (!filteredUnits.some((unit) => unit.id === selectedUnitId)) {
      setSelectedUnitId(filteredUnits[0].id)
    }
  }, [filteredUnits, selectedUnitId])

  if (!properties.length) {
    return (
      <div className="notice">
        No active properties or units are available for online request submission right now. Contact your property manager directly.
      </div>
    )
  }

  return (
    <form action={formAction} className="stack">
      {orgSlug && <input type="hidden" name="orgSlug" value={orgSlug} />}
      {state.error && <div className="notice error">{state.error}</div>}

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Property</span>
          <select
            className="input"
            name="propertyId"
            value={selectedPropertyId}
            onChange={(event) => setSelectedPropertyId(event.target.value)}
            required
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Unit</span>
          <select
            className="input"
            name="unitId"
            value={selectedUnitId}
            onChange={(event) => setSelectedUnitId(event.target.value)}
            required
            disabled={!filteredUnits.length}
          >
            {!filteredUnits.length && <option value="">No units available</option>}
            {filteredUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
                {unit.tenantName ? ` — ${unit.tenantName}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Your name</span>
          <input className="input" type="text" name="tenantName" placeholder="Taylor Reed" required />
        </label>

        <label className="field">
          <span className="field-label">Your email</span>
          <input className="input" type="email" name="tenantEmail" placeholder="taylor@example.com" required />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Issue title</span>
        <input className="input" type="text" name="title" placeholder="Kitchen sink leaking under cabinet" required />
      </label>

      <label className="field">
        <span className="field-label">Describe the problem</span>
        <textarea
          className="input textarea"
          name="description"
          rows={5}
          placeholder="What is happening, when did it start, and how bad is it?"
          required
        />
      </label>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Category</span>
          <select className="input" name="category" defaultValue={REQUEST_CATEGORIES[0]} required>
            {REQUEST_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Urgency</span>
          <select className="input" name="urgency" defaultValue="medium" required>
            {REQUEST_URGENCIES.map((urgency) => (
              <option key={urgency} value={urgency}>
                {urgency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Preferred currency</span>
          <select className="input" name="preferredCurrency" defaultValue="usd" required>
            <option value="usd">US Dollar</option>
            <option value="peso">Peso</option>
            <option value="pound">Pound</option>
            <option value="euro">Euro</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Preferred language</span>
          <select className="input" name="preferredLanguage" defaultValue="english" required>
            <option value="english">English</option>
            <option value="spanish">Spanish</option>
            <option value="french">French</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field-label">Photos</span>
        <input className="input" type="file" name="photos" accept="image/*" multiple />
        <span className="muted">Up to 5 images, 5 MB each.</span>
      </label>

      <button type="submit" className="button primary" disabled={isPending || !selectedUnitId}>
        {isPending ? 'Submitting…' : 'Submit maintenance request'}
      </button>
    </form>
  )
}
