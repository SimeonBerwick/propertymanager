'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { addCommentFormAction, type RequestActionState } from '@/lib/request-detail-actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: RequestActionState = { error: null }

export function AddCommentForm({
  requestId,
  defaultVisibility = 'internal',
  allowVisibilityChange = false,
}: {
  requestId: string
  defaultVisibility?: 'internal' | 'external'
  allowVisibilityChange?: boolean
}) {
  const [state, formAction, isPending] = useActionState(addCommentFormAction, INITIAL_STATE)
  const [visibility, setVisibility] = useState(defaultVisibility)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    setVisibility(defaultVisibility)
  }, [defaultVisibility])

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      router.replace(`/requests/${requestId}` as Route, { scroll: false })
      router.refresh()
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
    }
  }, [router, state.success])

  return (
    <form ref={formRef} action={formAction} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      {allowVisibilityChange ? (
        <label className="field">
          <span className="field-label">Who should see this?</span>
          <select
            className="input"
            name="visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as 'internal' | 'external')}
          >
            <option value="external">Tenant-facing reply</option>
            <option value="internal">Private internal note</option>
          </select>
        </label>
      ) : (
        <input type="hidden" name="visibility" value={visibility} />
      )}
      <label className="field">
        <span className="field-label">Add comment</span>
        <textarea
          className="input textarea"
          name="body"
          rows={3}
          placeholder={visibility === 'external' ? 'Write the reply the tenant will receive...' : 'Add a private note for the property manager...'}
          required
          style={{ minHeight: 80 }}
        />
      </label>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        {visibility === 'external' ? (
          <>
            <span className="badge signalHigh">Tenant-facing reply</span>
          </>
        ) : (
          <>
            <span className="badge signalNeutral">Private internal note</span>
          </>
        )}
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? 'Sending...' : visibility === 'external' ? 'Send tenant reply' : 'Save internal note'}
        </button>
      </div>
      {visibility === 'external' ? <div className="notice">This update is tenant-facing and will clear the tenant update alert after it is saved.</div> : null}
      <ActionFeedback error={state.error} success={state.success && (visibility === 'external' ? 'Reply sent to tenant.' : 'Internal note saved.')} />
    </form>
  )
}
