'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ActionFeedback } from '@/components/action-feedback'
import { sendTenantWorkOrderMessageAction, type TenantRequestActionState } from './actions'

const INITIAL_STATE: TenantRequestActionState = { error: null }

export function TenantWorkOrderMessageForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(sendTenantWorkOrderMessageAction, INITIAL_STATE)
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
    <form ref={formRef} action={action} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field">
        <span className="field-label">Message</span>
        <textarea className="input" name="body" rows={4} placeholder="Ask for a different appointment time or tell us about an issue with this repair." required />
      </label>
      <ActionFeedback error={state.error} success={state.success && 'Message sent.'} />
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Sending...' : 'Send message'}
      </button>
    </form>
  )
}
