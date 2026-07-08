'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addCommentFormAction, type RequestActionState } from '@/lib/request-detail-actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: RequestActionState = { error: null }

export function AddCommentForm({ requestId, defaultVisibility = 'internal' }: { requestId: string; defaultVisibility?: 'internal' | 'external' }) {
  const [state, formAction, isPending] = useActionState(addCommentFormAction, INITIAL_STATE)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      router.refresh()
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
    }
  }, [router, state.success])

  return (
    <form key={defaultVisibility} ref={formRef} action={formAction} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span className="field-label">Add comment</span>
        <textarea
          className="input textarea"
          name="body"
          rows={3}
          placeholder="Add an internal note or tenant-facing update..."
          required
          style={{ minHeight: 80 }}
        />
      </label>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <select className="input" name="visibility" defaultValue={defaultVisibility} style={{ width: 'auto' }}>
          <option value="internal">Internal note</option>
          <option value="external">Tenant-facing</option>
        </select>
        <button type="submit" className="button primary" disabled={isPending}>
          {isPending ? 'Saving...' : 'Add comment'}
        </button>
      </div>
      {defaultVisibility === 'external' ? <div className="notice">This update is tenant-facing and will clear the tenant update alert after it is saved.</div> : null}
      <ActionFeedback error={state.error} success={state.success && 'Comment added.'} />
    </form>
  )
}
