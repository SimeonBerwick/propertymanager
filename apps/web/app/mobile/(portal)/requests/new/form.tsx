'use client'

import { useActionState, useMemo, useState } from 'react'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { suggestRequestDetails } from '@/lib/request-guidance'
import { submitTenantMobileRequestAction, type MobileRequestState } from './actions'
import type { PersonalWorkPolicy } from '@/lib/personal-work'

const INITIAL_STATE: MobileRequestState = { error: null }

export function TenantNewRequestForm({ personalWorkPolicy }: { personalWorkPolicy?: PersonalWorkPolicy }) {
  const [state, formAction, isPending] = useActionState(submitTenantMobileRequestAction, INITIAL_STATE)
  const [problem, setProblem] = useState('')
  const [description, setDescription] = useState('')
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null)
  const [urgencyOverride, setUrgencyOverride] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [personalWorkRequested, setPersonalWorkRequested] = useState(false)
  const suggestion = useMemo(() => suggestRequestDetails(problem, description), [problem, description])
  const category = categoryOverride ?? suggestion.category
  const urgency = urgencyOverride ?? suggestion.urgency
  const personalWorkAvailable = Boolean(personalWorkPolicy?.enabled && personalWorkPolicy.allowedCategories.includes(category) && !['high', 'urgent'].includes(urgency))

  return (
    <form action={formAction} className="stack">
      {state.error && <div className="notice error">{state.error}</div>}
      <label className="field">
        <span className="field-label">Issue title</span>
        <input className="input" type="text" name="title" placeholder="Kitchen sink leaking under cabinet" value={problem} onChange={(event) => setProblem(event.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">Describe the problem</span>
        <textarea className="input textarea" name="description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">Photos</span>
        <input className="input" type="file" name="photos" accept="image/*" multiple />
        <span className="muted">Up to 3 images, 5 MB each. If upload fails, remove large photos and try again.</span>
      </label>
      <div className="notice" style={{ background: '#f5fff7', borderColor: '#b7ebc6' }}>
        <strong>Suggested routing: {category}</strong>
        <div className="muted">Likely attention level: {urgency}. You can adjust these details before submitting.</div>
        <button type="button" className="button" style={{ marginTop: 10 }} onClick={() => setShowDetails((value) => !value)}>
          {showDetails ? 'Hide details' : 'Adjust details'}
        </button>
      </div>
      {!showDetails ? (
        <>
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="urgency" value={urgency} />
          <input type="hidden" name="preferredLanguage" value="english" />
        </>
      ) : (
        <div className="stack">
          <div className="grid cols-2">
            <label className="field">
              <span className="field-label">Category</span>
              <select className="input" name="category" value={category} onChange={(event) => setCategoryOverride(event.target.value)} required>
                {REQUEST_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Urgency</span>
              <select className="input" name="urgency" value={urgency} onChange={(event) => setUrgencyOverride(event.target.value)} required>
                {REQUEST_URGENCIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field-label">Preferred language</span>
            <select className="input" name="preferredLanguage" defaultValue="english" required>
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="french">French</option>
            </select>
          </label>
        </div>
      )}
      {personalWorkAvailable && personalWorkPolicy ? <div className="notice stack">
        <label className="row"><input type="checkbox" name="personalWorkRequested" value="true" checked={personalWorkRequested} onChange={(event) => setPersonalWorkRequested(event.target.checked)} /><strong>Request optional personal work at my expense</strong></label>
        {personalWorkRequested ? <><div>${(personalWorkPolicy.hourlyRateCents / 100).toFixed(2)} per hour, {personalWorkPolicy.minimumMinutes}-minute minimum, plus materials.</div><label className="row"><input type="checkbox" name="personalWorkTermsAccepted" value="true" required /> I accept these terms and authorize a tenant charge.</label><label className="field"><span className="field-label">Maximum amount I authorize ($)</span><input className="input" type="number" name="personalWorkAuthorizedMax" min={(personalWorkPolicy.minimumChargeCents / 100).toFixed(2)} max="100000" step="0.01" required /></label></> : null}
      </div> : null}
      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  )
}
