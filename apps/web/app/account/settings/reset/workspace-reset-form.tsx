'use client'

import { useActionState } from 'react'
import { ActionFeedback } from '@/components/action-feedback'
import { cancelWorkspaceResetAction, requestWorkspaceResetAction, type WorkspaceResetState } from './actions'
import { logout } from '@/lib/auth-actions'

const INITIAL_STATE: WorkspaceResetState = { error: null, success: null }

export function WorkspaceResetForm({ pendingReset }: { pendingReset: { scheduledFor: string } | null }) {
  const [state, action, pending] = useActionState(requestWorkspaceResetAction, INITIAL_STATE)

  if (pendingReset) {
    const scheduledFor = new Date(pendingReset.scheduledFor).toLocaleString('en-US', {
      timeZone: 'America/Phoenix',
      dateStyle: 'long',
      timeStyle: 'short',
    })
    return (
      <div className="stack">
        <div className="notice error">
          <strong>Workspace reset pending</strong>
          <div>Your operational workspace is read-only. Permanent erasure is scheduled for {scheduledFor} Arizona time.</div>
        </div>
        <form action={cancelWorkspaceResetAction}>
          <button type="submit" className="button primary">Cancel workspace reset</button>
        </form>
        <form action={logout}>
          <button type="submit" className="button">Sign out</button>
        </form>
      </div>
    )
  }

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <ActionFeedback error={state.error} success={state.success} />

      <label className="field">
        <span className="field-label">Reason or portfolio-change notes</span>
        <textarea className="input" name="reason" maxLength={1000} rows={4} placeholder="Optional" />
      </label>

      <label className="field">
        <span className="field-label">Current password</span>
        <input className="input" type="password" name="password" autoComplete="current-password" required />
      </label>

      <label className="field">
        <span className="field-label">Type RESET MY WORKSPACE</span>
        <input className="input" name="confirmation" autoComplete="off" required />
      </label>

      <label className="row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" name="confirm" value="yes" required />
        <span>I understand that the listed operational data and connected integrations will be permanently removed after 24 hours, while my subscription and billing remain active.</span>
      </label>

      <button type="submit" className="button primary" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending ? 'Scheduling reset...' : 'Schedule workspace reset'}
      </button>
    </form>
  )
}
