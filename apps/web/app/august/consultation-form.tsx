'use client'

import { useActionState, useEffect } from 'react'
import { trackProductEvent } from '@/components/analytics-tracker'
import type { AugustCampaignSource } from '@/lib/campaign-attribution'
import { submitConsultationRequest, type ConsultationState } from './actions'

const initialState: ConsultationState = { error: null, referenceId: null }

export function ConsultationForm({ source }: { source: AugustCampaignSource }) {
  const [state, action, pending] = useActionState(submitConsultationRequest, initialState)

  useEffect(() => {
    if (!state.referenceId) return
    trackProductEvent('campaign_consultation_submitted', {
      campaign: 'august_founders',
      source,
    })
  }, [source, state.referenceId])

  if (state.referenceId) {
    return (
      <div className="notice success" role="status">
        <strong>Your conversation request is in.</strong>
        <p>We will email you to arrange a 20-minute time. Keep this reference: <strong>{state.referenceId}</strong>.</p>
      </div>
    )
  }

  return (
    <form action={action} className="stack">
      {state.error ? <div className="notice error" role="alert">{state.error}</div> : null}
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Your name</span>
          <input className="input" name="name" autoComplete="name" maxLength={120} required />
        </label>
        <label className="field">
          <span className="field-label">Work email</span>
          <input className="input" name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
      </div>
      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Company or organization</span>
          <input className="input" name="organization" autoComplete="organization" maxLength={160} required />
        </label>
        <label className="field">
          <span className="field-label">Approximate portfolio size</span>
          <select className="input" name="portfolioSize" defaultValue="" required>
            <option value="" disabled>Choose a range</option>
            <option value="1-25 units">1-25 units</option>
            <option value="26-75 units">26-75 units</option>
            <option value="76-250 units">76-250 units</option>
            <option value="251-500 units">251-500 units</option>
            <option value="More than 500 units">More than 500 units</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Phone number <span className="muted">(optional)</span></span>
        <input className="input" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} />
      </label>
      <label className="field">
        <span className="field-label">What would you most like to improve? <span className="muted">(optional)</span></span>
        <textarea className="input textarea" name="notes" rows={4} maxLength={2000} />
      </label>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <input type="hidden" name="source" value={source} />
      <button className="button primary buttonLarge" type="submit" disabled={pending}>
        {pending ? 'Sending request...' : 'Request my conversation'}
      </button>
      <p className="muted" style={{ margin: 0 }}>No sales call without your request. We use these details only to respond about Simeonware.</p>
    </form>
  )
}
