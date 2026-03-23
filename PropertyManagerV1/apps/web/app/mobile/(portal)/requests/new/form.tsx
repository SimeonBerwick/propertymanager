'use client'

import { useActionState } from 'react'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { submitTenantMobileRequestAction, type MobileRequestState } from './actions'

const INITIAL_STATE: MobileRequestState = { error: null }

export function TenantNewRequestForm() {
  const [state, formAction, isPending] = useActionState(submitTenantMobileRequestAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="notice error">{state.error}</div>}
      <label className="field">
        <span className="field-label">Issue title</span>
        <input className="input" type="text" name="title" placeholder="Kitchen sink leaking under cabinet" required />
      </label>
      <label className="field">
        <span className="field-label">Describe the problem</span>
        <textarea className="input textarea" name="description" rows={5} required />
      </label>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Category</span>
          <select className="input" name="category" defaultValue={REQUEST_CATEGORIES[0]} required>
            {REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Urgency</span>
          <select className="input" name="urgency" defaultValue="medium" required>
            {REQUEST_URGENCIES.map((urgency) => <option key={urgency} value={urgency}>{urgency}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Photos</span>
        <input className="input" type="file" name="photos" accept="image/*" multiple />
        <span className="muted">Up to 5 images, 5 MB each.</span>
      </label>
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  )
}
