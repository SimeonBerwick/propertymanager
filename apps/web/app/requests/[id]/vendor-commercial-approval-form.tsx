'use client'

import { useActionState } from 'react'
import { approveVendorCommercialItemAction, type RequestActionState } from '@/lib/request-detail-actions'

const INITIAL_STATE: RequestActionState = { error: null }

export function VendorCommercialApprovalForm({ requestId, itemId, label }: { requestId: string; itemId: string; label?: string }) {
  const [state, formAction, pending] = useActionState(approveVendorCommercialItemAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="itemId" value={itemId} />
      {state.error ? <div className="notice error">{state.error}</div> : null}
      {state.success ? <div className="notice success">{state.message ?? 'Approved.'}</div> : null}
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Approving…' : (label ?? 'Approve')}
      </button>
    </form>
  )
}
