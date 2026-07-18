'use client'

import { useActionState } from 'react'
import { submitSupportRequest, type SupportState } from './actions'

const initialState: SupportState = { error: null, referenceId: null }

export function SupportForm({ errorReference, initialCategory }: { errorReference?: string; initialCategory?: 'feedback' }) {
  const [state, action, pending] = useActionState(submitSupportRequest, initialState)

  if (state.referenceId) {
    return (
      <div className="notice success" role="status">
        <strong>Support request received.</strong><br />
        Keep this reference: {state.referenceId}. Support can now trace the request from submission through resolution.
      </div>
    )
  }

  return (
    <form action={action} className="stack">
      {state.error ? <div className="notice error" role="alert">{state.error}</div> : null}
      <div className="grid cols-2">
        <label className="field"><span className="field-label">Your name</span><input className="input" name="name" autoComplete="name" /></label>
        <label className="field"><span className="field-label">Reply email</span><input className="input" name="email" type="email" autoComplete="email" /></label>
      </div>
      <label className="field"><span className="field-label">Organization</span><input className="input" name="organization" autoComplete="organization" /></label>
      <label className="field">
        <span className="field-label">What do you need help with?</span>
        <select className="input" name="category" defaultValue={initialCategory ?? 'technical_problem'} required>
          <option value="technical_problem">A technical problem</option>
          <option value="account_access">Account access</option>
          <option value="maintenance_workflow">A maintenance workflow</option>
          <option value="billing">Billing or subscription</option>
          <option value="feedback">Product feedback</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">What happened?</span>
        <textarea className="input textarea" name="message" rows={6} minLength={20} maxLength={4000} defaultValue={errorReference ? `I received error reference ${errorReference}. ` : ''} required />
      </label>
      <input type="hidden" name="pagePath" value={errorReference ? `error:${errorReference}` : '/support'} />
      <button className="button primary" type="submit" disabled={pending}>{pending ? 'Sending...' : 'Send to support'}</button>
    </form>
  )
}
