'use client'

import { useActionState } from 'react'
import { syncQuickBooksAction, type QuickBooksActionState } from '@/app/account/quickbooks/actions'
import { ActionFeedback } from '@/components/action-feedback'

const INITIAL: QuickBooksActionState = { error: null }

export function QuickBooksSyncButton({ requestId, sourceType, sourceId, previouslySynced }: { requestId: string; sourceType: 'billing_document' | 'staff_cost'; sourceId: string; previouslySynced: boolean }) {
  const [state, action, pending] = useActionState(syncQuickBooksAction, INITIAL)
  return <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
    <form action={action}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="sourceType" value={sourceType} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <button className="button primary" type="submit" disabled={pending}>{pending ? 'Syncing...' : previouslySynced && sourceType === 'billing_document' ? 'Refresh payment status' : previouslySynced ? 'Synced' : 'Sync to QuickBooks'}</button>
    </form>
    <ActionFeedback error={state.error} success={state.success} />
  </div>
}
