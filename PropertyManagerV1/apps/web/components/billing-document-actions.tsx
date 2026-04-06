'use client'

import { useActionState } from 'react'
import { resendBillingDocumentAction, duplicateBillingDocumentAction, voidBillingDocumentAction, type BillingActionState } from '@/lib/billing-actions'

const INITIAL_STATE: BillingActionState = { error: null }

export function BillingDocumentActions({ billingDocumentId, requestId }: { billingDocumentId: string; requestId: string }) {
  const [resendState, resendAction, resendPending] = useActionState(resendBillingDocumentAction, INITIAL_STATE)
  const [duplicateState, duplicateAction, duplicatePending] = useActionState(duplicateBillingDocumentAction, INITIAL_STATE)
  const [voidState, voidAction, voidPending] = useActionState(voidBillingDocumentAction, INITIAL_STATE)

  return (
    <div className="billingActionsRow">
      <form action={resendAction}>
        <input type="hidden" name="billingDocumentId" value={billingDocumentId} />
        <input type="hidden" name="requestId" value={requestId} />
        <button type="submit" className="button">{resendPending ? 'Sending…' : 'Resend'}</button>
      </form>
      <form action={duplicateAction}>
        <input type="hidden" name="billingDocumentId" value={billingDocumentId} />
        <input type="hidden" name="requestId" value={requestId} />
        <button type="submit" className="button">{duplicatePending ? 'Duplicating…' : 'Duplicate'}</button>
      </form>
      <form action={voidAction}>
        <input type="hidden" name="billingDocumentId" value={billingDocumentId} />
        <input type="hidden" name="requestId" value={requestId} />
        <button type="submit" className="button">{voidPending ? 'Voiding…' : 'Void'}</button>
      </form>
      {resendState.error ? <div className="notice error">{resendState.error}</div> : null}
      {duplicateState.error ? <div className="notice error">{duplicateState.error}</div> : null}
      {voidState.error ? <div className="notice error">{voidState.error}</div> : null}
    </div>
  )
}
