'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { updateUnitAction, type PropertyActionState } from '@/lib/property-actions'

const INITIAL_STATE: PropertyActionState = { error: null }

interface EditUnitFormProps {
  unitId: string
  propertyId: string
  initialLabel: string
  initialTenantName?: string
  initialTenantEmail?: string
}

export function EditUnitForm({
  unitId,
  propertyId,
  initialLabel,
  initialTenantName,
  initialTenantEmail,
}: EditUnitFormProps) {
  const [state, formAction, isPending] = useActionState(updateUnitAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="notice error">{state.error}</div>}

      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="propertyId" value={propertyId} />

      <label className="field">
        <span className="field-label">Unit label</span>
        <input
          className="input"
          type="text"
          name="label"
          defaultValue={initialLabel}
          maxLength={100}
          required
        />
      </label>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">
            Tenant name <span className="muted">(optional)</span>
          </span>
          <input className="input" type="text" name="tenantName" defaultValue={initialTenantName} maxLength={120} />
        </label>

        <label className="field">
          <span className="field-label">
            Tenant email <span className="muted">(optional)</span>
          </span>
          <input className="input" type="email" name="tenantEmail" defaultValue={initialTenantEmail} maxLength={254} />
        </label>
      </div>

      <div className="row">
        <Link href={`/units/${unitId}`} className="button">Cancel</Link>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save unit'}
        </button>
      </div>
    </form>
  )
}
