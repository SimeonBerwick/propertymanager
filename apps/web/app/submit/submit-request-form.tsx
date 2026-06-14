'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import type { Property, Unit } from '@/lib/types'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { submitMaintenanceRequest, type SubmitRequestState } from '@/lib/request-actions'
import { trackProductEvent } from '@/components/analytics-tracker'

const INITIAL_STATE: SubmitRequestState = { error: null }

interface SubmitRequestFormProps {
  properties: Property[]
  units: Unit[]
  orgSlug?: string
  templates?: Array<{ id: string, name: string, title: string, description: string, category: string, urgency: string }>
}

export function SubmitRequestForm({ properties, units, orgSlug, templates = [] }: SubmitRequestFormProps) {
  const [state, formAction, isPending] = useActionState(submitMaintenanceRequest, INITIAL_STATE)
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.id ?? '')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [tenantEmail, setTenantEmail] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<(typeof REQUEST_CATEGORIES)[number]>(REQUEST_CATEGORIES[0])
  const [urgency, setUrgency] = useState('medium')
  const [hydrated, setHydrated] = useState(false)
  const draftEventSent = useRef(false)
  const draftKey = `pm-intake-draft:${orgSlug ?? 'default'}`

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

  useEffect(() => {
    try {
      const draft = JSON.parse(window.localStorage.getItem(draftKey) ?? 'null')
      if (draft) {
        setSelectedPropertyId(draft.selectedPropertyId ?? selectedPropertyId)
        setSelectedUnitId(draft.selectedUnitId ?? '')
        setTenantName(draft.tenantName ?? '')
        setTenantEmail(draft.tenantEmail ?? '')
        setTitle(draft.title ?? '')
        setDescription(draft.description ?? '')
        setCategory(draft.category ?? REQUEST_CATEGORIES[0])
        setUrgency(draft.urgency ?? 'medium')
      }
    } catch {
      // Ignore invalid local drafts.
    }
    setHydrated(true)
    trackProductEvent('intake_started', { scoped: Boolean(orgSlug), orgSlug })
    // Restore once for this form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useEffect(() => {
    if (!hydrated) return
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ selectedPropertyId, selectedUnitId, tenantName, tenantEmail, title, description, category, urgency }))
      if (!draftEventSent.current) {
        trackProductEvent('intake_draft_saved', { scoped: Boolean(orgSlug), orgSlug })
        draftEventSent.current = true
      }
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [category, description, draftKey, hydrated, orgSlug, selectedPropertyId, selectedUnitId, tenantEmail, tenantName, title, urgency])

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    setTitle(template.title)
    setDescription(template.description)
    setCategory(template.category as (typeof REQUEST_CATEGORIES)[number])
    setUrgency(template.urgency)
    trackProductEvent('intake_template_used', { templateId, orgSlug })
  }

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
      {templates.length ? <label className="field"><span className="field-label">Start from a common request</span><select className="input" defaultValue="" onChange={(event) => applyTemplate(event.target.value)}><option value="">Choose a template</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}</select></label> : null}
      <div className="notice">Drafts save automatically on this device. You can close this page and continue later.</div>

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
          <input className="input" type="text" name="tenantName" placeholder="Taylor Reed" value={tenantName} onChange={(event) => setTenantName(event.target.value)} required />
        </label>

        <label className="field">
          <span className="field-label">Your email</span>
          <input className="input" type="email" name="tenantEmail" placeholder="taylor@example.com" value={tenantEmail} onChange={(event) => setTenantEmail(event.target.value)} required />
        </label>
      </div>

      <label className="field">
        <span className="field-label">Issue title</span>
        <input className="input" type="text" name="title" placeholder="Kitchen sink leaking under cabinet" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </label>

      <label className="field">
        <span className="field-label">Describe the problem</span>
        <textarea
          className="input textarea"
          name="description"
          rows={5}
          placeholder="What is happening, when did it start, and how bad is it?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </label>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Category</span>
          <select className="input" name="category" value={category} onChange={(event) => setCategory(event.target.value as (typeof REQUEST_CATEGORIES)[number])} required>
            {REQUEST_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Urgency</span>
          <select className="input" name="urgency" value={urgency} onChange={(event) => setUrgency(event.target.value)} required>
            {REQUEST_URGENCIES.map((urgency) => (
              <option key={urgency} value={urgency}>
                {urgency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <input type="hidden" name="preferredCurrency" value="usd" />
      <label className="field">
        <span className="field-label">Preferred language</span>
        <select className="input" name="preferredLanguage" defaultValue="english" required>
          <option value="english">English</option>
          <option value="spanish">Spanish</option>
          <option value="french">French</option>
        </select>
      </label>

      <label className="field">
        <span className="field-label">Photos</span>
        <input className="input" type="file" name="photos" accept="image/*" multiple />
        <span className="muted">Up to 3 images, 5 MB each.</span>
      </label>

      <button type="submit" className="button primary" disabled={isPending || !selectedUnitId}>
        {isPending ? 'Submitting…' : 'Submit maintenance request'}
      </button>
    </form>
  )
}
