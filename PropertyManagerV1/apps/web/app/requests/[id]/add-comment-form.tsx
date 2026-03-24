'use client'

import { useActionState, useEffect, useRef } from 'react'
import { addCommentFormAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

export function AddCommentForm({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(addCommentFormAction, INITIAL_STATE)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
    }
  }, [state.success])

  return (
    <form ref={formRef} action={formAction} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span className="field-label">Add comment</span>
        <textarea
          className="input textarea"
          name="body"
          rows={3}
          placeholder="Add an internal note or tenant-facing update…"
          required
          style={{ minHeight: 80 }}
        />
      </label>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <select className="input" name="visibility" defaultValue="internal" style={{ width: 'auto' }}>
          <option value="internal">Internal note</option>
          <option value="external">Tenant-facing</option>
        </select>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Add comment'}
        </button>
      </div>
      {state.error && <div className="notice error">{state.error}</div>}
      {state.success && <div className="notice success">Comment added.</div>}
    </form>
  )
}
