'use client'

import { useActionState } from 'react'
import { approveVendorCommercialItemAction, type RequestActionState } from '@/lib/request-detail-actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL_STATE: RequestActionState = { error: null }

export function VendorCommercialApprovalForm({ requestId, itemId, label }: { requestId: string; itemId: string; label?: string }) {
  const [state, formAction, pending] = useActionState(approveVendorCommercialItemAction, INITIAL_STATE)

  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="itemId" value={itemId} />
      <ActionFeedback error={state.error} success={state.success ? state.message ?? 'Approved.' : null} />
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Approving…' : (label ?? 'Approve')}
      </button>
    </form>
  )
}
