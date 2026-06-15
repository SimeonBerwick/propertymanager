'use client'

import { useActionState } from 'react'
import { updateBusinessNameAction, type BusinessNameState } from './actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: BusinessNameState = { error: null, success: null }

export function BusinessNameForm({ businessName }: { businessName: string | null }) {
  const [state, action, pending] = useActionState(updateBusinessNameAction, INITIAL_STATE)

  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <ActionFeedback error={state.error} success={state.success} />
      <label className="field">
        <span className="field-label">Business name</span>
        <input
          className="input"
          name="businessName"
          type="text"
          maxLength={160}
          autoComplete="organization"
          defaultValue={businessName ?? ''}
          placeholder="Optional"
        />
        <span className="muted">Shown to vendors so they know which property management business is contacting them.</span>
      </label>
      <button type="submit" className="button primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? 'Saving...' : 'Save business name'}
      </button>
    </form>
  )
}
